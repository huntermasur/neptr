import { describe, expect, it } from "vitest";
import { configFromFlags, validateProjectName, withDefaults, DEFAULTS } from "../src/config.js";

describe("validateProjectName", () => {
  it("accepts lowercase names with dots, dashes and underscores", () => {
    expect(validateProjectName("my-rad_app.2")).toBeUndefined();
  });

  it("rejects empty, uppercase, leading-symbol, and whitespace names", () => {
    expect(validateProjectName("")).toBeDefined();
    expect(validateProjectName("MyApp")).toBeDefined();
    expect(validateProjectName("-app")).toBeDefined();
    expect(validateProjectName("my app")).toBeDefined();
  });
});

describe("configFromFlags", () => {
  it("merges provided flags and leaves gaps undefined", () => {
    const partial = configFromFlags("my-app", { template: "vue-ts", docker: false });
    expect(partial.projectName).toBe("my-app");
    expect(partial.template).toBe("vue-ts");
    expect(partial.docker).toBe(false);
    expect(partial.git).toBeUndefined();
  });

  it("rejects unknown templates and unknown MCP servers", () => {
    expect(() => configFromFlags(undefined, { template: "angular" })).toThrow(/Unknown template/);
    expect(() => configFromFlags(undefined, { mcp: "codegraph,nope" })).toThrow(/Unknown MCP server/);
  });

  it('treats "none" and empty strings as empty lists', () => {
    expect(configFromFlags(undefined, { mcp: "none" }).mcpServers).toEqual([]);
    expect(configFromFlags(undefined, { skills: "none" }).skills).toEqual([]);
    expect(configFromFlags(undefined, { agents: "" }).agents).toEqual([]);
  });

  it("accepts owner/repo and owner/repo@skill skill sources", () => {
    const partial = configFromFlags(undefined, { skills: "anthropics/skills, vercel-labs/skills@find-skills" });
    expect(partial.skills).toEqual(["anthropics/skills", "vercel-labs/skills@find-skills"]);
  });

  it("rejects skill sources that are not plain owner/repo[@skill]", () => {
    expect(() => configFromFlags(undefined, { skills: "not-a-repo" })).toThrow(/Invalid skill/);
    expect(() => configFromFlags(undefined, { skills: "owner/repo & echo pwned" })).toThrow(/Invalid skill/);
    expect(() => configFromFlags(undefined, { skills: "owner/repo@bad skill" })).toThrow(/Invalid skill/);
  });
});

describe("withDefaults", () => {
  it("requires a project name", () => {
    expect(() => withDefaults({})).toThrow(/Project name is required/);
  });

  it("fills every gap from DEFAULTS", () => {
    const config = withDefaults({ projectName: "zz-beemo-test-nonexistent", yes: true });
    expect(config.template).toBe(DEFAULTS.template);
    expect(config.mcpServers).toEqual(DEFAULTS.mcpServers);
    expect(config.agents).toEqual(DEFAULTS.agents);
    expect(config.docker).toBe(DEFAULTS.docker);
    expect(config.targetDir.endsWith("zz-beemo-test-nonexistent")).toBe(true);
  });

  it("refuses to target an existing directory", () => {
    // "src" exists in the repo root, where vitest runs.
    expect(() => withDefaults({ projectName: "src" })).toThrow(/already exists/);
  });
});
