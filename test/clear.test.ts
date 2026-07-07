import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FEATURE_WORKSPACE_MARKER, isFeatureWorkspace, listFeatureWorkspaces } from "../src/clear.js";

function writeStatus(dir: string, note: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "STATUS.md"),
    `# Status\n\n## Log\n\n| Date | Status | Note |\n| --- | --- | --- |\n| 2026-01-01 | created | ${note} |\n`,
  );
}

describe("isFeatureWorkspace", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-clear-test-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("recognizes a neptr feature workspace by its STATUS.md log row", () => {
    writeStatus(dir, FEATURE_WORKSPACE_MARKER);
    expect(isFeatureWorkspace(dir)).toBe(true);
  });

  it("rejects adopt workspaces and folders without STATUS.md", () => {
    writeStatus(dir, "Adoption workspace scaffolded by `neptr adopt`");
    expect(isFeatureWorkspace(dir)).toBe(false);

    const empty = path.join(dir, "empty");
    fs.mkdirSync(empty);
    expect(isFeatureWorkspace(empty)).toBe(false);
  });
});

describe("listFeatureWorkspaces", () => {
  let featuresDir: string;
  beforeEach(() => {
    featuresDir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-clear-list-"));
  });
  afterEach(() => {
    fs.rmSync(featuresDir, { recursive: true, force: true });
  });

  it("returns only feature workspaces, not adopt or unrelated folders", () => {
    writeStatus(path.join(featuresDir, "dark-mode"), FEATURE_WORKSPACE_MARKER);
    writeStatus(path.join(featuresDir, "adopt-neptr-layout"), "Adoption workspace scaffolded by `neptr adopt`");
    fs.mkdirSync(path.join(featuresDir, "random-notes"));

    expect(listFeatureWorkspaces(featuresDir)).toEqual(["dark-mode"]);
  });

  it("returns an empty list when the feature folder is missing", () => {
    expect(listFeatureWorkspaces(path.join(featuresDir, "missing"))).toEqual([]);
  });
});
