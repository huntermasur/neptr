import { describe, expect, it } from "vitest";
import {
  deriveServerConfig,
  fetchSecurityScore,
  gatherMcpCandidates,
  gradeMeets,
  normalizeRegistry,
  searchMcpServers,
  verdictFromGrade,
  type FetchLike,
} from "../src/mcp-registry.js";

/** A trimmed skillful.sh `/api/v1/items` list response. */
const SEARCH_BODY = JSON.stringify({
  items: [
    {
      slug: "markitdown",
      name: "markitdown",
      description: "Convert files to Markdown",
      author: "microsoft",
      packageName: "markitdown",
      packageRegistry: "pypi",
      repositoryUrl: "https://github.com/microsoft/markitdown",
      license: "MIT",
      stats: { githubStars: 90950, pypiMonthlyDownloads: 10989293, directoryCount: 3 },
    },
    {
      slug: "playwright-mcp",
      name: "@playwright/mcp",
      description: "Browser automation",
      author: "microsoft",
      packageName: "@playwright/mcp",
      packageRegistry: "npm",
      stats: { githubStars: 12000, npmWeeklyDownloads: 5400, directoryCount: 4 },
    },
    {
      slug: "remote-only",
      name: "remote-only",
      description: "A hosted server",
      author: "someone",
      packageRegistry: "other",
      stats: { githubStars: 3, directoryCount: 1 },
    },
    { slug: "", name: "broken" },
  ],
  pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
});

/** Detail responses keyed by slug. */
const DETAIL: Record<string, string> = {
  "/api/v1/items/markitdown": JSON.stringify({ slug: "markitdown", securityScore: { grade: "A", overallScore: 100 } }),
  "/api/v1/items/playwright-mcp": JSON.stringify({ slug: "playwright-mcp", securityScore: { grade: "C", overallScore: 71 } }),
  "/api/v1/items/remote-only": JSON.stringify({ slug: "remote-only" }),
};

function stubFetch(routes: Record<string, { status?: number; body: string }>): FetchLike {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.entries(routes).find(([key]) => url.includes(key));
    if (!match) return new Response("not found", { status: 404 });
    const { status = 200, body } = match[1];
    return new Response(body, { status });
  }) as FetchLike;
}

describe("normalizeRegistry", () => {
  it("maps known registries and falls back to other", () => {
    expect(normalizeRegistry("npm")).toBe("npm");
    expect(normalizeRegistry("PyPI")).toBe("pypi");
    expect(normalizeRegistry("cargo")).toBe("other");
    expect(normalizeRegistry(undefined)).toBe("other");
  });
});

describe("deriveServerConfig", () => {
  it("builds npx for npm and uvx for pypi", () => {
    expect(deriveServerConfig("@playwright/mcp", "npm")).toEqual({ type: "stdio", command: "npx", args: ["-y", "@playwright/mcp"] });
    expect(deriveServerConfig("markitdown", "pypi")).toEqual({ type: "stdio", command: "uvx", args: ["markitdown"] });
  });

  it("returns null without a package name or for unknown registries", () => {
    expect(deriveServerConfig(undefined, "npm")).toBeNull();
    expect(deriveServerConfig("thing", "other")).toBeNull();
  });
});

describe("gradeMeets / verdictFromGrade", () => {
  it("passes only at or above the threshold", () => {
    expect(gradeMeets("A", "B")).toBe(true);
    expect(gradeMeets("B", "A")).toBe(false);
    expect(gradeMeets(null, "F")).toBe(false);
  });

  it("classifies verdicts around the threshold", () => {
    expect(verdictFromGrade("A", "A")).toBe("pass");
    expect(verdictFromGrade("C", "A")).toBe("warn");
    expect(verdictFromGrade("F", "A")).toBe("fail");
    expect(verdictFromGrade(null, "A")).toBe("unscored");
  });
});

describe("searchMcpServers", () => {
  it("parses items, drops slugless rows, and applies the limit", async () => {
    const fetchImpl = stubFetch({ "/api/v1/items?type=mcp_server": { body: SEARCH_BODY } });
    const results = await searchMcpServers("anything", 2, fetchImpl);
    expect(results).toHaveLength(2);
    expect(results[0]?.slug).toBe("markitdown");
    expect(results[0]?.weeklyDownloads).toBe(10989293);
    expect(results[1]?.registry).toBe("npm");
  });

  it("throws on a non-200 response", async () => {
    const fetchImpl = stubFetch({ "/api/v1/items?type=mcp_server": { status: 429, body: "slow down" } });
    await expect(searchMcpServers("x", 5, fetchImpl)).rejects.toThrow(/HTTP 429/);
  });
});

describe("fetchSecurityScore", () => {
  it("returns the grade and score when present", async () => {
    const fetchImpl = stubFetch(Object.fromEntries(Object.entries(DETAIL).map(([k, body]) => [k, { body }])));
    expect(await fetchSecurityScore("markitdown", fetchImpl)).toEqual({ grade: "A", score: 100 });
  });

  it("returns nulls when the server is unscanned", async () => {
    const fetchImpl = stubFetch(Object.fromEntries(Object.entries(DETAIL).map(([k, body]) => [k, { body }])));
    expect(await fetchSecurityScore("remote-only", fetchImpl)).toEqual({ grade: null, score: null });
  });
});

describe("gatherMcpCandidates", () => {
  it("attaches verdicts and launch configs, and marks unscanned servers", async () => {
    const routes: Record<string, { status?: number; body: string }> = {
      "/api/v1/items?type=mcp_server": { body: SEARCH_BODY },
    };
    for (const [k, body] of Object.entries(DETAIL)) routes[k] = { body };
    const fetchImpl = stubFetch(routes);

    const candidates = await gatherMcpCandidates("markdown", { limit: 20, minGrade: "A", fetchImpl });
    expect(candidates).toHaveLength(3);

    const [markitdown, playwright, remote] = candidates;
    expect(markitdown?.verdict).toBe("pass");
    expect(markitdown?.serverConfig).toEqual({ type: "stdio", command: "uvx", args: ["markitdown"] });

    expect(playwright?.verdict).toBe("warn");
    expect(playwright?.serverConfig?.command).toBe("npx");

    expect(remote?.verdict).toBe("unscored");
    expect(remote?.serverConfig).toBeNull();
  });
});
