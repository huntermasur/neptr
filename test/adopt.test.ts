import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inferConfig, inferTemplate } from "../src/adopt.js";
import { buildInventory, suggestSection } from "../src/adopt-scan.js";

describe("suggestSection", () => {
  it("routes framework entry files to app/", () => {
    expect(suggestSection("src/main.tsx").section).toBe("app");
    expect(suggestSection("src/index.ts").section).toBe("app");
    expect(suggestSection("src/App.tsx").section).toBe("app");
  });

  it("recognizes known vendors even when glued to other words", () => {
    expect(suggestSection("src/stripeClient.ts").section).toBe("integrations");
    expect(suggestSection("src/lib/openaiApi.ts").section).toBe("integrations");
  });

  it("matches short vendor tokens (aws, s3) only at word starts", () => {
    expect(suggestSection("src/awsClient.ts").section).toBe("integrations");
    expect(suggestSection("src/s3Uploader.ts").section).toBe("integrations");
    expect(suggestSection("src/aws-config.ts").section).toBe("integrations");
    expect(suggestSection("src/laws/rules.ts").section).not.toBe("integrations");
    expect(suggestSection("src/render/css3.ts").section).not.toBe("integrations");
  });

  it("maps common role keywords to their sections", () => {
    expect(suggestSection("src/components/Button.tsx").section).toBe("modules");
    expect(suggestSection("src/utils/format.ts").section).toBe("shared");
    expect(suggestSection("src/services/billing.ts").section).toBe("services");
    expect(suggestSection("src/models/user.ts").section).toBe("data");
    expect(suggestSection("src/config/env.ts").section).toBe("config");
    expect(suggestSection("src/routes/home.ts").section).toBe("app");
  });

  it("falls back to modules and flags it for confirmation", () => {
    const r = suggestSection("src/thing.ts");
    expect(r.section).toBe("modules");
    expect(r.why).toContain("confirm");
  });
});

describe("inferTemplate", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-adopt-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("detects React + TS from deps and tsconfig", () => {
    fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    const pkg = { dependencies: { react: "^18" }, devDependencies: { typescript: "^5" } };
    expect(inferTemplate(dir, pkg)).toBe("react-ts");
  });

  it("detects Vue without TS", () => {
    const pkg = { dependencies: { vue: "^3" } };
    expect(inferTemplate(dir, pkg)).toBe("vue");
  });

  it("falls back to vanilla-ts when nothing matches", () => {
    fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
    expect(inferTemplate(dir, {})).toBe("vanilla-ts");
  });
});

describe("inferConfig", () => {
  it("reads a package.json with a UTF-8 BOM (Windows editors) instead of ignoring it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-adopt-bom-"));
    try {
      fs.writeFileSync(path.join(dir, "package.json"), `﻿{"name":"bom-app","dependencies":{"react":"^18"}}`);
      const config = inferConfig(dir, []);
      expect(config.projectName).toBe("bom-app");
      expect(config.template).toBe("react");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("buildInventory", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-adopt-inv-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("notes when there is no src/ directory", () => {
    expect(buildInventory(dir)).toContain("No `src/` directory");
  });

  it("lists source files with a suggested section and skips node_modules", () => {
    fs.mkdirSync(path.join(dir, "src", "utils"), { recursive: true });
    fs.mkdirSync(path.join(dir, "src", "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "main.tsx"), "export const x = 1;");
    fs.writeFileSync(path.join(dir, "src", "utils", "format.ts"), "export const f = 1;");
    fs.writeFileSync(path.join(dir, "src", "node_modules", "dep.js"), "module.exports = 1;");

    const table = buildInventory(dir);
    expect(table).toContain("Found 2 source file(s)");
    expect(table).toContain("`src/main.tsx`");
    expect(table).toContain("`src/utils/format.ts`");
    expect(table).not.toContain("node_modules");
  });

  it("leaves .test./.spec. files to the tests inventory", () => {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "a.ts"), "export const a = 1;");
    fs.writeFileSync(path.join(dir, "src", "a.test.ts"), "export {};");
    fs.writeFileSync(path.join(dir, "src", "b.spec.tsx"), "export {};");

    const table = buildInventory(dir);
    expect(table).toContain("Found 1 source file(s)");
    expect(table).toContain("`src/a.ts`");
    expect(table).not.toContain("a.test.ts");
    expect(table).not.toContain("b.spec.tsx");
  });
});
