import { describe, expect, it } from "vitest";
import { slugify, validateFeatureName } from "../src/feature.js";

describe("slugify", () => {
  it("kebab-cases spaces and underscores", () => {
    expect(slugify("Dark Mode toggle")).toBe("dark-mode-toggle");
    expect(slugify("dark_mode_toggle")).toBe("dark-mode-toggle");
  });

  it("strips symbols and collapses/trims dashes", () => {
    expect(slugify("  Fancy!! (v2) --- feature  ")).toBe("fancy-v2-feature");
    expect(slugify("---x---")).toBe("x");
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("validateFeatureName", () => {
  it("accepts a reasonable name", () => {
    expect(validateFeatureName("dark-mode toggle")).toBeUndefined();
  });

  it("rejects blank, over-long, and symbol-only names", () => {
    expect(validateFeatureName("   ")).toBeDefined();
    expect(validateFeatureName("x".repeat(51))).toBeDefined();
    expect(validateFeatureName("$$$")).toBeDefined();
  });
});
