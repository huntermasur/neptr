import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkBroadAccess,
  checkRunnable,
  checkVendor,
  checkVersionPin,
  deriveServerConfig,
  type FetchLike,
  gatherMcpCandidates,
  normalizeRegistry,
  parseGithubRepo,
  parseNamespace,
  type RegistryServer,
  rankServers,
  searchMcpServers,
  verifyServer,
} from "../src/mcp-registry.js";

/** A trimmed registry `/v0/servers` response covering npm, oci, and remote-only. */
const SEARCH_BODY = JSON.stringify({
  servers: [
    {
      server: {
        name: "io.github.microsoft/playwright-mcp",
        description: "Browser automation for agents",
        version: "0.3.1",
        repository: { url: "https://github.com/microsoft/playwright-mcp", source: "github" },
        packages: [
          { registryType: "npm", identifier: "@playwright/mcp", version: "0.3.1", transport: { type: "stdio" } },
        ],
      },
      _meta: { "io.modelcontextprotocol.registry/official": { status: "active", updatedAt: "2026-06-01T00:00:00Z" } },
    },
    {
      server: {
        name: "io.github.someone/oci-tool",
        description: "A containerized helper",
        version: "1.0.0",
        repository: { url: "https://github.com/someone/oci-tool", source: "github" },
        packages: [{ registryType: "oci", identifier: "someone/oci-tool:1.0.0", version: "1.0.0" }],
      },
      _meta: { "io.modelcontextprotocol.registry/official": { status: "active", updatedAt: "2026-05-01T00:00:00Z" } },
    },
    {
      server: {
        name: "com.example/remote-only",
        description: "A hosted server",
        repository: { url: "https://example.com/repo" },
        remotes: [{ type: "streamable-http", url: "https://mcp.example.com/sse" }],
      },
      _meta: { "io.modelcontextprotocol.registry/official": { status: "active" } },
    },
    { server: { description: "no name" }, _meta: {} },
  ],
  metadata: { count: 3 },
});

/** GitHub repo detail responses keyed by owner/repo path. */
const REPOS: Record<string, string> = {
  "/repos/microsoft/playwright-mcp": JSON.stringify({
    pushed_at: "2026-06-20T00:00:00Z",
    archived: false,
    open_issues_count: 12,
  }),
  "/repos/someone/oci-tool": JSON.stringify({
    pushed_at: "2020-01-01T00:00:00Z",
    archived: true,
    open_issues_count: 300,
  }),
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

const npmServer: RegistryServer = {
  name: "io.github.microsoft/playwright-mcp",
  description: "Browser automation",
  version: "0.3.1",
  repositoryUrl: "https://github.com/microsoft/playwright-mcp",
  packages: [{ registryType: "npm", identifier: "@playwright/mcp", version: "0.3.1", hasEnvVars: false }],
  remotes: [],
};

describe("normalizeRegistry", () => {
  it("maps known registries and falls back to other", () => {
    expect(normalizeRegistry("npm")).toBe("npm");
    expect(normalizeRegistry("PyPI")).toBe("pypi");
    expect(normalizeRegistry("docker")).toBe("oci");
    expect(normalizeRegistry("cargo")).toBe("other");
    expect(normalizeRegistry(undefined)).toBe("other");
  });
});

describe("parseNamespace / parseGithubRepo", () => {
  it("splits reverse-DNS namespaces and finds the github owner", () => {
    expect(parseNamespace("io.github.microsoft/playwright-mcp")).toEqual({
      prefix: "io.github.microsoft",
      githubOwner: "microsoft",
    });
    expect(parseNamespace("com.stripe/api")).toEqual({ prefix: "com.stripe", githubOwner: undefined });
  });

  it("extracts owner/repo from a github url", () => {
    expect(parseGithubRepo("https://github.com/microsoft/playwright-mcp")).toEqual({
      owner: "microsoft",
      repo: "playwright-mcp",
    });
    expect(parseGithubRepo("https://github.com/foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
    expect(parseGithubRepo("https://example.com/repo")).toBeNull();
    expect(parseGithubRepo(undefined)).toBeNull();
  });
});

describe("deriveServerConfig", () => {
  it("pins the version for npm, pypi, and oci", () => {
    expect(deriveServerConfig(npmServer)).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "@playwright/mcp@0.3.1"],
    });
    expect(
      deriveServerConfig({
        ...npmServer,
        packages: [{ registryType: "pypi", identifier: "markitdown", version: "0.1.2", hasEnvVars: false }],
      }),
    ).toEqual({ type: "stdio", command: "uvx", args: ["markitdown@0.1.2"] });
    expect(
      deriveServerConfig({
        ...npmServer,
        packages: [{ registryType: "oci", identifier: "acme/img:1.0.0", version: "1.0.0", hasEnvVars: false }],
      }),
    ).toEqual({ type: "stdio", command: "docker", args: ["run", "-i", "--rm", "acme/img:1.0.0"] });
  });

  it("falls back to an http remote, or null", () => {
    expect(
      deriveServerConfig({ ...npmServer, packages: [], remotes: [{ type: "streamable-http", url: "https://x/sse" }] }),
    ).toEqual({ type: "http", url: "https://x/sse" });
    expect(deriveServerConfig({ ...npmServer, packages: [], remotes: [] })).toBeNull();
  });
});

describe("verifier checks", () => {
  it("recognizes verified vendors vs community namespaces", () => {
    expect(checkVendor("io.github.microsoft/playwright-mcp").status).toBe("ok");
    expect(checkVendor("com.stripe/api").status).toBe("ok");
    expect(checkVendor("io.github.random-dev/thing").status).toBe("warn");
    expect(checkVendor("io.github.random-dev/thing").detail).toContain("random-dev");
  });

  it("flags broad access from keywords", () => {
    expect(checkBroadAccess(npmServer).detail).toContain("browser");
    expect(
      checkBroadAccess({ ...npmServer, name: "com.acme/calc", description: "adds numbers", packages: [] }).status,
    ).toBe("ok");
  });

  it("classifies runnability and version pinning", () => {
    expect(checkRunnable(npmServer).status).toBe("ok");
    expect(checkRunnable({ ...npmServer, packages: [], remotes: [{ type: "http", url: "https://x" }] }).status).toBe(
      "warn",
    );
    expect(checkVersionPin(npmServer).status).toBe("ok");
    expect(
      checkVersionPin({ ...npmServer, packages: [{ registryType: "npm", identifier: "x", hasEnvVars: false }] }).status,
    ).toBe("warn");
  });

  it("treats an explicit non-latest OCI image tag as a version pin", () => {
    const oci = (identifier: string) =>
      checkVersionPin({ ...npmServer, packages: [{ registryType: "oci" as const, identifier, hasEnvVars: false }] });
    expect(oci("ghcr.io/github/github-mcp-server:1.0.0").status).toBe("ok");
    expect(oci("ghcr.io/github/github-mcp-server:1.0.0").detail).toContain("1.0.0");
    expect(oci("ghcr.io/x/y:latest").status).toBe("warn");
    expect(oci("ghcr.io/x/y").status).toBe("warn");
  });
});

describe("verifyServer verdicts", () => {
  it("marks a vendor server with no broad access as safe", () => {
    const server: RegistryServer = {
      ...npmServer,
      name: "io.github.microsoft/calc",
      description: "adds numbers",
      packages: [{ registryType: "npm", identifier: "calc", version: "1.0.0", hasEnvVars: false }],
    };
    const v = verifyServer(server, { pushedAt: "2026-06-01T00:00:00Z", archived: false, openIssues: 3 });
    expect(v.verdict).toBe("safe");
  });

  it("marks an archived repo as avoid", () => {
    const v = verifyServer(npmServer, { pushedAt: "2020-01-01T00:00:00Z", archived: true, openIssues: 5 });
    expect(v.verdict).toBe("avoid");
  });

  it("marks a community server with unknown activity as caution", () => {
    // Community namespace + no reachable GitHub activity → no trust anchor.
    const server: RegistryServer = { ...npmServer, name: "io.github.dev/fs", description: "filesystem access" };
    const v = verifyServer(server, null);
    expect(v.verdict).toBe("caution");
  });

  it("promotes a maintained community server to safe (broad access is non-blocking)", () => {
    // Community, but active + local + version-pinned → safe; access is only a note.
    const server: RegistryServer = { ...npmServer, name: "io.github.dev/fs", description: "filesystem access" };
    const v = verifyServer(server, { pushedAt: "2026-06-01T00:00:00Z", archived: false, openIssues: 4 });
    expect(v.verdict).toBe("safe");
    expect(v.checks.find((c) => c.id === "access")?.status).toBe("warn");
  });

  it("stays safe when github activity is merely unknown", () => {
    const server: RegistryServer = {
      ...npmServer,
      name: "io.github.microsoft/calc",
      description: "adds numbers",
      packages: [{ registryType: "npm", identifier: "calc", version: "1.0.0", hasEnvVars: false }],
    };
    expect(verifyServer(server, null).verdict).toBe("safe");
  });
});

describe("searchMcpServers", () => {
  it("parses servers, drops nameless rows, and applies the limit", async () => {
    const fetchImpl = stubFetch({ "/v0/servers": { body: SEARCH_BODY } });
    const results = await searchMcpServers("anything", 2, fetchImpl);
    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe("io.github.microsoft/playwright-mcp");
    expect(results[0]?.packages[0]?.identifier).toBe("@playwright/mcp");
    expect(results[1]?.packages[0]?.registryType).toBe("oci");
  });

  it("throws on a non-200 response", async () => {
    const fetchImpl = stubFetch({ "/v0/servers": { status: 429, body: "slow down" } });
    await expect(searchMcpServers("x", 5, fetchImpl)).rejects.toThrow(/HTTP 429/);
  });
});

describe("rankServers", () => {
  const junk: RegistryServer = {
    name: "ai.smithery/random-wrapper",
    description: "hosted wrapper",
    repositoryUrl: undefined,
    packages: [],
    remotes: [{ type: "http", url: "https://x/sse" }],
  };
  const communityPinned: RegistryServer = {
    ...npmServer,
    name: "io.github.dev/tool",
    packages: [{ registryType: "npm", identifier: "tool", version: "1.0.0", hasEnvVars: false }],
  };

  it("puts verified vendors and runnable+pinned servers above remote-only junk", () => {
    const ranked = rankServers([junk, communityPinned, npmServer]);
    expect(ranked.map((s) => s.name)).toEqual([
      "io.github.microsoft/playwright-mcp",
      "io.github.dev/tool",
      "ai.smithery/random-wrapper",
    ]);
  });

  it("sinks non-active servers and keeps registry order for ties", () => {
    const deprecated: RegistryServer = { ...npmServer, name: "io.github.microsoft/old", status: "deprecated" };
    const junkTwin: RegistryServer = { ...junk, name: "ai.smithery/other-wrapper" };
    const ranked = rankServers([deprecated, junk, junkTwin]);
    expect(ranked.map((s) => s.name)).toEqual([
      "ai.smithery/random-wrapper",
      "ai.smithery/other-wrapper",
      "io.github.microsoft/old",
    ]);
  });
});

describe("gatherMcpCandidates", () => {
  it("attaches verdicts and pinned configs, degrading gracefully on GitHub", async () => {
    const routes: Record<string, { status?: number; body: string }> = { "/v0/servers": { body: SEARCH_BODY } };
    for (const [k, body] of Object.entries(REPOS)) routes[k] = { body };
    const fetchImpl = stubFetch(routes);

    const candidates = await gatherMcpCandidates("browser", { limit: 20, fetchImpl });
    expect(candidates).toHaveLength(3);

    const [playwright, oci, remote] = candidates;
    // Vendor + active + local + pinned → safe (broad-access "browser" is only a note).
    expect(playwright?.verification.verdict).toBe("safe");
    expect(playwright?.serverConfig).toEqual({ type: "stdio", command: "npx", args: ["-y", "@playwright/mcp@0.3.1"] });
    expect(playwright?.activityProbe).toBe("ok");

    // Archived repo → avoid.
    expect(oci?.verification.verdict).toBe("avoid");
    expect(oci?.serverConfig?.type).toBe("stdio");

    // Remote-only, non-github repo → caution, http config, no probe to run.
    expect(remote?.verification.verdict).toBe("caution");
    expect(remote?.serverConfig).toEqual({ type: "http", url: "https://mcp.example.com/sse" });
    expect(remote?.activityProbe).toBe("none");
  });

  it("ranks the pool before applying the limit, so junk-first search order cannot bury good servers", async () => {
    // The registry lists an alphabetically-earlier remote-only server first;
    // limit 1 must still surface the vendor server further down the pool.
    const body = JSON.stringify({
      servers: [
        {
          server: {
            name: "ai.smithery/wrapper",
            description: "hosted wrapper",
            remotes: [{ type: "http", url: "https://x/sse" }],
          },
          _meta: {},
        },
        JSON.parse(SEARCH_BODY).servers[0],
      ],
    });
    const fetchImpl = stubFetch({
      "/v0/servers": { body },
      "/repos/microsoft/playwright-mcp": { body: REPOS["/repos/microsoft/playwright-mcp"] as string },
    });
    const candidates = await gatherMcpCandidates("browser", { limit: 1, fetchImpl });
    expect(candidates.map((c) => c.name)).toEqual(["io.github.microsoft/playwright-mcp"]);
  });

  it("merges known-vendor namespace results so a vendor-name query finds the official server", async () => {
    // "github" substring-matches every io.github.* namespace, so the plain
    // pool only contains community servers; the vendor supplement queries
    // io.github.github / com.github directly.
    const junkBody = JSON.stringify({
      servers: [
        {
          server: {
            name: "io.github.someone/gh-linter",
            description: "community helper",
            remotes: [{ type: "http", url: "https://x/sse" }],
          },
          _meta: {},
        },
      ],
    });
    const officialBody = JSON.stringify({
      servers: [
        {
          server: {
            name: "io.github.github/github-mcp-server",
            description: "GitHub's official MCP server",
            repository: { url: "https://github.com/github/github-mcp-server" },
            packages: [{ registryType: "oci", identifier: "ghcr.io/github/github-mcp-server:1.0.0", version: "1.0.0" }],
          },
          _meta: { "io.modelcontextprotocol.registry/official": { status: "active" } },
        },
      ],
    });
    // Specific keys first: stubFetch picks the first route contained in the URL.
    const fetchImpl = stubFetch({
      "search=io.github.github": { body: officialBody },
      "search=com.github": { body: JSON.stringify({ servers: [] }) },
      "search=github": { body: junkBody },
      "/repos/github/github-mcp-server": {
        body: JSON.stringify({ pushed_at: "2026-06-20T00:00:00Z", archived: false, open_issues_count: 10 }),
      },
    });
    const candidates = await gatherMcpCandidates("github", { limit: 1, fetchImpl });
    expect(candidates.map((c) => c.name)).toEqual(["io.github.github/github-mcp-server"]);
    expect(candidates[0]?.verification.verdict).toBe("safe");
  });

  it("flags failed GitHub probes so callers can tell rate limiting from a real safety verdict", async () => {
    // GitHub route missing → 404 → activity null, but the repo URL is GitHub.
    const fetchImpl = stubFetch({ "/v0/servers": { body: SEARCH_BODY } });
    const candidates = await gatherMcpCandidates("browser", { limit: 20, fetchImpl });
    expect(candidates[0]?.activityProbe).toBe("failed");
    // Vendor server stays safe on unknown activity; the flag records the gap.
    expect(candidates[0]?.verification.verdict).toBe("safe");
  });

  it("caches GitHub activity on disk and reuses it on the next invocation", async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "neptr-mcp-test-"));
    try {
      let repoHits = 0;
      const counting: FetchLike = (async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/v0/servers")) return new Response(SEARCH_BODY, { status: 200 });
        if (url.includes("/repos/")) {
          repoHits++;
          const key = Object.keys(REPOS).find((k) => url.includes(k));
          return key ? new Response(REPOS[key] as string, { status: 200 }) : new Response("nope", { status: 404 });
        }
        return new Response("not found", { status: 404 });
      }) as FetchLike;

      const first = await gatherMcpCandidates("browser", { limit: 20, fetchImpl: counting, cacheDir });
      const hitsAfterFirst = repoHits;
      expect(hitsAfterFirst).toBeGreaterThan(0);

      const second = await gatherMcpCandidates("browser", { limit: 20, fetchImpl: counting, cacheDir });
      // Both GitHub-backed servers resolved from cache — no extra API spend.
      expect(repoHits).toBe(hitsAfterFirst);
      expect(second[0]?.verification.verdict).toBe(first[0]?.verification.verdict);
      expect(second[0]?.activityProbe).toBe("ok");
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });
});
