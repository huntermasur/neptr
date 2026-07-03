import { describe, expect, it } from "vitest";
import { renderString } from "../src/template.js";

describe("renderString", () => {
  it("replaces known placeholders", () => {
    expect(renderString("Hello {{name}}!", { name: "BMO" })).toBe("Hello BMO!");
  });

  it("leaves unknown placeholders intact so they're easy to spot", () => {
    expect(renderString("Hello {{mystery}}!", {})).toBe("Hello {{mystery}}!");
  });

  it("drops a line whose placeholders all rendered empty", () => {
    const template = "line one\n{{optionalRow}}\nline three";
    expect(renderString(template, { optionalRow: "" })).toBe("line one\nline three");
  });

  it("drops indented placeholder-only lines but keeps them when the var has content", () => {
    const template = "1. step\n   {{hint}}\n2. step";
    expect(renderString(template, { hint: "" })).toBe("1. step\n2. step");
    expect(renderString(template, { hint: "a hint" })).toBe("1. step\n   a hint\n2. step");
  });

  it("keeps lines that mix text with an empty placeholder", () => {
    expect(renderString("before {{gone}} after", { gone: "" })).toBe("before  after");
  });

  it("supports multi-line replacement values", () => {
    expect(renderString("{{rows}}\nend", { rows: "a\nb" })).toBe("a\nb\nend");
  });

  it("keeps genuinely blank template lines", () => {
    expect(renderString("a\n\nb", {})).toBe("a\n\nb");
  });
});
