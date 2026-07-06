import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  detectDocker,
  buildDockerInventory,
  suggestDocTarget,
  buildDocsInventory,
  suggestTestTarget,
  buildTestsInventory,
  buildEnvInventory,
  detectWorkspaces,
} from "../src/adopt-scan.js";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-adopt-scan-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("detectDocker", () => {
  it("detects express + postgres + redis from deps", () => {
    const pkg = { dependencies: { express: "^4", pg: "^8", ioredis: "^5" } };
    const scan = detectDocker(dir, pkg);
    expect(scan.hasServer).toBe(true);
    expect(scan.hasDb).toBe(true);
    expect(scan.services.map((s) => s.label)).toEqual(["Express", "PostgreSQL", "Redis"]);
    expect(scan.services.find((s) => s.label === "Redis")?.kind).toBe("cache");
    expect(scan.appPort).toBe(3000);
  });

  it("resolves the app port from .env.example", () => {
    fs.writeFileSync(path.join(dir, ".env.example"), "PORT=4000\nDATABASE_URL=\n");
    const scan = detectDocker(dir, { dependencies: { express: "^4" } });
    expect(scan.appPort).toBe(4000);
  });

  it("resolves the app port from package.json scripts", () => {
    const pkg = { dependencies: { fastify: "^4" }, scripts: { dev: "node server.js --port 8081" } };
    expect(detectDocker(dir, pkg).appPort).toBe(8081);
  });

  it("adds a db from the prisma schema provider when no driver is present", () => {
    fs.mkdirSync(path.join(dir, "prisma"));
    fs.writeFileSync(
      path.join(dir, "prisma", "schema.prisma"),
      'datasource db {\n  provider = "postgresql"\n  url = env("DATABASE_URL")\n}\n',
    );
    const scan = detectDocker(dir, { dependencies: { "@prisma/client": "^5" } });
    expect(scan.orms).toEqual(["prisma (postgresql)"]);
    expect(scan.services.find((s) => s.kind === "db")?.composeService).toBe("postgres");
  });

  it("does not duplicate the db when both driver and ORM are present", () => {
    fs.mkdirSync(path.join(dir, "prisma"));
    fs.writeFileSync(path.join(dir, "prisma", "schema.prisma"), 'provider = "postgresql"');
    const scan = detectDocker(dir, { dependencies: { pg: "^8", prisma: "^5" } });
    expect(scan.services.filter((s) => s.kind === "db")).toHaveLength(1);
  });

  it("records sqlite as a note, not a compose service", () => {
    const scan = detectDocker(dir, { dependencies: { "better-sqlite3": "^9" } });
    const db = scan.services.find((s) => s.kind === "db");
    expect(db?.composeService).toBeUndefined();
    expect(db?.note).toContain("file-based");
  });

  it("records existing docker files at the root", () => {
    fs.writeFileSync(path.join(dir, "Dockerfile"), "FROM node");
    fs.writeFileSync(path.join(dir, "docker-compose.yml"), "services: {}");
    const scan = detectDocker(dir, {});
    expect(scan.existingFiles).toEqual(["Dockerfile", "docker-compose.yml"]);
  });

  it("flags vite-only projects", () => {
    const scan = detectDocker(dir, { devDependencies: { vite: "^5" } });
    expect(scan.hasVite).toBe(true);
    expect(scan.hasServer).toBe(false);
    expect(scan.services).toHaveLength(0);
  });
});

describe("buildDockerInventory", () => {
  it("renders the services table, drafts, and existing files", () => {
    const scan = detectDocker(dir, { dependencies: { express: "^4", pg: "^8" } });
    const inv = buildDockerInventory(scan, ["Dockerfile", "docker-compose.yml"]);
    expect(inv).toContain("| server | Express |");
    expect(inv).toContain("`postgres:16-alpine`");
    expect(inv).toContain("DRAFT header");
  });

  it("explains when nothing was detected or drafted", () => {
    const inv = buildDockerInventory(detectDocker(dir, {}), [], "no server, database, or Vite app detected");
    expect(inv).toContain("No server or database dependencies detected");
    expect(inv).toContain("no server, database, or Vite app detected");
  });
});

describe("suggestDocTarget", () => {
  it("routes ADRs, architecture, setup, and reference docs", () => {
    expect(suggestDocTarget("docs/adr/0001-use-postgres.md").target).toContain("architecture/adr");
    expect(suggestDocTarget("docs/system-design.md").target).toContain(".docs/architecture/");
    expect(suggestDocTarget("SETUP.md").target).toContain("environment.md");
    expect(suggestDocTarget("docs/api-reference.md").target).toContain(".docs/documents/");
    expect(suggestDocTarget("docs/misc.md").why).toContain("confirm");
  });
});

describe("buildDocsInventory", () => {
  it("inventories docs/ and root md files, excluding README and agent files", () => {
    fs.mkdirSync(path.join(dir, "docs"));
    fs.writeFileSync(path.join(dir, "docs", "architecture.md"), "# arch");
    fs.writeFileSync(path.join(dir, "SETUP.md"), "# setup");
    fs.writeFileSync(path.join(dir, "README.md"), "# readme");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# claude");
    const inv = buildDocsInventory(dir);
    expect(inv).toContain("Found 2 doc file(s)");
    expect(inv).toContain("`docs/architecture.md`");
    expect(inv).toContain("`SETUP.md`");
    expect(inv).not.toContain("README.md");
    expect(inv).not.toContain("CLAUDE.md");
  });

  it("never descends into .docs/", () => {
    fs.mkdirSync(path.join(dir, ".docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".docs", "environment.md"), "# env");
    expect(buildDocsInventory(dir)).toContain("No documentation found");
  });
});

describe("suggestTestTarget", () => {
  const srcFiles = new Map([["format", "src/utils/format.ts"]]);

  it("keeps co-located src tests with their source", () => {
    expect(suggestTestTarget("src/utils/format.test.ts", srcFiles).target).toBe("stays co-located");
  });

  it("routes e2e and fixture files to root tests/", () => {
    expect(suggestTestTarget("e2e/login.spec.ts", srcFiles).target).toBe("`tests/`");
    expect(suggestTestTarget("test/fixtures/user.ts", srcFiles).target).toBe("`tests/`");
  });

  it("co-locates a unit test next to its subject's target section", () => {
    const r = suggestTestTarget("test/format.test.ts", srcFiles);
    expect(r.target).toContain("src/shared/");
    expect(r.why).toContain("src/utils/format.ts");
  });

  it("falls back to tests/ and flags for confirmation", () => {
    const r = suggestTestTarget("test/weird.test.ts", srcFiles);
    expect(r.target).toBe("`tests/`");
    expect(r.why).toContain("confirm");
  });
});

describe("buildTestsInventory", () => {
  it("finds test files, reports the runner, and suggests targets", () => {
    fs.mkdirSync(path.join(dir, "test"));
    fs.mkdirSync(path.join(dir, "e2e"));
    fs.mkdirSync(path.join(dir, "src", "utils"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "utils", "format.ts"), "export const f = 1;");
    fs.writeFileSync(path.join(dir, "test", "format.test.ts"), "it()");
    fs.writeFileSync(path.join(dir, "e2e", "login.spec.ts"), "it()");
    fs.writeFileSync(path.join(dir, "vitest.config.ts"), "export default {}");
    const pkg = { devDependencies: { vitest: "^1" } };
    const inv = buildTestsInventory(dir, pkg);
    expect(inv).toContain("Found 2 test file(s)");
    expect(inv).toContain("`vitest`");
    expect(inv).toContain("`vitest.config.ts`");
    expect(inv).toContain("`test/format.test.ts`");
    expect(inv).toContain("`e2e/login.spec.ts`");
  });

  it("notes when there are no tests", () => {
    expect(buildTestsInventory(dir, {})).toContain("No test files found");
  });
});

describe("buildEnvInventory", () => {
  it("lists env files and variable names from .env.example only", () => {
    fs.writeFileSync(path.join(dir, ".env"), "SECRET_KEY=hunter2\n");
    fs.writeFileSync(path.join(dir, ".env.example"), "SECRET_KEY=\nPORT=3000\n");
    const inv = buildEnvInventory(dir);
    expect(inv).toContain("`.env`");
    expect(inv).toContain("`SECRET_KEY`");
    expect(inv).toContain("`PORT`");
    expect(inv).not.toContain("hunter2");
  });

  it("never reads values out of .env when no example exists", () => {
    fs.writeFileSync(path.join(dir, ".env"), "SECRET_KEY=hunter2\n");
    const inv = buildEnvInventory(dir);
    expect(inv).not.toContain("hunter2");
    expect(inv).not.toContain("SECRET_KEY=");
    expect(inv).toContain("No `.env.example`");
  });
});

describe("detectWorkspaces", () => {
  it("detects npm workspaces and workspace config files", () => {
    expect(detectWorkspaces(dir, { workspaces: ["packages/*"] })).toContain("npm workspaces");
    fs.writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages: []");
    expect(detectWorkspaces(dir, {})).toContain("pnpm-workspace.yaml");
  });

  it("returns undefined for a plain project", () => {
    expect(detectWorkspaces(dir, {})).toBeUndefined();
  });
});
