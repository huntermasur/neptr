import { describe, expect, it } from "vitest";
import { stackLabel, templateVars } from "../src/steps/ai-docs.js";
import type { NEPTRConfig } from "../src/config.js";

describe("stackLabel", () => {
  it("labels TS and JS variants", () => {
    expect(stackLabel("react-ts")).toBe("React + TypeScript + Vite");
    expect(stackLabel("vanilla")).toBe("Vanilla + JavaScript + Vite");
    expect(stackLabel("react-swc-ts")).toBe("React (SWC) + TypeScript + Vite");
    expect(stackLabel("qwik")).toBe("Qwik + JavaScript + Vite");
  });
});

function config(overrides: Partial<NEPTRConfig>): NEPTRConfig {
  return {
    projectName: "test-app",
    targetDir: "/tmp/test-app",
    template: "react-ts",
    mcpServers: [],
    skills: [],
    agents: [],
    docker: false,
    git: true,
    installDeps: true,
    yes: true,
    ...overrides,
  };
}

describe("templateVars", () => {
  it("emits a vite.config row matching the template language", () => {
    expect(templateVars(config({ template: "react-ts" })).viteConfigRow).toContain("vite.config.ts");
    expect(templateVars(config({ template: "vue" })).viteConfigRow).toContain("vite.config.js");
    expect(templateVars(config({ template: "vanilla-ts" })).viteConfigRow).toBe("");
  });

  it("adds folder rows only for the selected agents and docker", () => {
    const none = templateVars(config({}));
    expect(none.extraFolderRows).toBe("");

    const all = templateVars(config({ agents: ["copilot", "cursor"], docker: true }));
    expect(all.extraFolderRows).toContain(".github/");
    expect(all.extraFolderRows).toContain(".cursor/");
    expect(all.extraFolderRows).toContain("Dockerfile");
  });
});
