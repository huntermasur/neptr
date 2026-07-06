import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildRepoMap, installIndexing, runIndex } from "../src/indexer.js";

/** Minimal project: a src/ file plus marker-bearing hub docs in the given EOL. */
function seedProject(dir: string, eol: "\n" | "\r\n"): void {
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "thing.ts"), "/** A thing. */\nexport const thing = 1;\n");
  fs.mkdirSync(path.join(dir, ".agents"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".agents", "KNOWLEDGE_MAP.md"),
    [
      "# Knowledge map",
      "",
      "<!-- neptr:foldermap:start -->",
      "| STALE-FOLDERS |",
      "<!-- neptr:foldermap:end -->",
      "",
      "<!-- neptr:keyfiles:start -->",
      "| STALE-KEYFILES |",
      "<!-- neptr:keyfiles:end -->",
      "",
    ].join(eol),
  );
  fs.writeFileSync(
    path.join(dir, ".agents", "CAPABILITIES.md"),
    [
      "# Capabilities",
      "",
      "<!-- neptr:skills:start -->",
      "| STALE-SKILLS |",
      "<!-- neptr:skills:end -->",
      "",
      "<!-- neptr:mcp:start -->",
      "| STALE-MCP |",
      "<!-- neptr:mcp:end -->",
      "",
    ].join(eol),
  );
}

describe("marker table refresh", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-indexer-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refreshes LF marker tables", () => {
    seedProject(dir, "\n");
    installIndexing(dir);
    const map = fs.readFileSync(path.join(dir, ".agents", "KNOWLEDGE_MAP.md"), "utf8");
    expect(map).not.toContain("STALE-FOLDERS");
    expect(map).not.toContain("STALE-KEYFILES");
    expect(map).toContain("| `src/` |");
  });

  it("installs .gitattributes pinning generated docs to LF, idempotently", () => {
    seedProject(dir, "\n");
    installIndexing(dir);
    const attrs = fs.readFileSync(path.join(dir, ".gitattributes"), "utf8");
    expect(attrs).toContain(".docs/REPO_MAP.md text eol=lf");
    expect(attrs).toContain(".agents/KNOWLEDGE_MAP.md text eol=lf");
    installIndexing(dir);
    expect(fs.readFileSync(path.join(dir, ".gitattributes"), "utf8")).toBe(attrs);
  });

  it("refreshes CRLF marker tables (autocrlf checkouts)", () => {
    seedProject(dir, "\r\n");
    installIndexing(dir);
    const map = fs.readFileSync(path.join(dir, ".agents", "KNOWLEDGE_MAP.md"), "utf8");
    const caps = fs.readFileSync(path.join(dir, ".agents", "CAPABILITIES.md"), "utf8");
    expect(map).not.toContain("STALE-FOLDERS");
    expect(map).toContain("| `src/` |");
    expect(caps).not.toContain("STALE-SKILLS");
    expect(caps).not.toContain("STALE-MCP");
  });
});

describe("runIndex --check", () => {
  let dir: string;
  let prevCwd: string;
  let prevExitCode: typeof process.exitCode;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-index-check-"));
    prevCwd = process.cwd();
    prevExitCode = process.exitCode;
    process.exitCode = undefined;
    seedProject(dir, "\n");
    installIndexing(dir);
    process.chdir(dir);
  });
  afterEach(() => {
    process.chdir(prevCwd);
    process.exitCode = prevExitCode;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("passes right after an index run", async () => {
    await runIndex({ check: true, quiet: true });
    expect(process.exitCode ?? 0).toBe(0);
  });

  it("tolerates a CRLF working copy of an up-to-date repo map", async () => {
    const mapPath = path.join(dir, ".docs", "REPO_MAP.md");
    const lf = fs.readFileSync(mapPath, "utf8");
    fs.writeFileSync(mapPath, lf.replace(/\n/g, "\r\n"));
    await runIndex({ check: true, quiet: true });
    expect(process.exitCode ?? 0).toBe(0);
  });

  it("fails when a marker table is stale even though the repo map is fresh", async () => {
    const capsPath = path.join(dir, ".agents", "CAPABILITIES.md");
    const caps = fs.readFileSync(capsPath, "utf8");
    fs.writeFileSync(
      capsPath,
      caps.replace(
        /<!-- neptr:skills:start -->[\s\S]*?<!-- neptr:skills:end -->/,
        "<!-- neptr:skills:start -->\n| STALE |\n<!-- neptr:skills:end -->",
      ),
    );
    await runIndex({ check: true, quiet: true });
    expect(process.exitCode).toBe(1);
  });

  it("fails when the repo map is stale", async () => {
    fs.writeFileSync(path.join(dir, "src", "extra.ts"), "export const extra = 2;\n");
    await runIndex({ check: true, quiet: true });
    expect(process.exitCode).toBe(1);
  });
});

describe("buildRepoMap", () => {
  it("is byte-stable across runs and always LF", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-repomap-"));
    try {
      seedProject(dir, "\n");
      const first = buildRepoMap(dir);
      expect(buildRepoMap(dir)).toBe(first);
      expect(first).not.toContain("\r");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
