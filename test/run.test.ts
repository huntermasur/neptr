import { describe, expect, it } from "vitest";
import { shellQuote } from "../src/run.js";

describe("shellQuote", () => {
  it("wraps whitespace-bearing args so cmd.exe keeps them as one token", () => {
    expect(shellQuote(["commit", "-m", "Initial commit from NEPTR"])).toEqual([
      "commit",
      "-m",
      '"Initial commit from NEPTR"',
    ]);
  });

  it("leaves single-token args untouched", () => {
    expect(shellQuote(["config", "core.hooksPath", ".githooks"])).toEqual(["config", "core.hooksPath", ".githooks"]);
  });
});
