import { describe, expect, it } from "vitest";
import {
  gatherCandidates,
  isGithubSource,
  isSafeInstallArg,
  parseAudits,
  searchSkills,
  toInstallArg,
  verdictFromAudits,
  type FetchLike,
} from "../src/skills-registry.js";

/** A trimmed copy of the real skills.sh "Security Audits" section markup. */
const AUDIT_HTML = `
<div class="text-sm font-mono uppercase text-white mb-3">Security Audits</div><div class="divide-y divide-border">
<a class="block" href="/vercel-labs/agent-skills/web-design-guidelines/security/agent-trust-hub"><div class="flex"><span class="text-sm font-medium text-foreground truncate">Gen Agent Trust Hub</span><span class="text-xs font-mono uppercase px-2 py-1 rounded bg-green-500/10 text-green-500">Pass</span></div></a>
<a class="block" href="/vercel-labs/agent-skills/web-design-guidelines/security/socket"><div class="flex"><span class="text-sm font-medium text-foreground truncate">Socket</span><span class="text-xs font-mono uppercase px-2 py-1 rounded bg-green-500/10 text-green-500">Pass</span></div></a>
<a class="block" href="/vercel-labs/agent-skills/web-design-guidelines/security/snyk"><div class="flex"><span class="text-sm font-medium text-foreground truncate">Snyk</span><span class="text-xs font-mono uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-500">Warn</span></div></a>
</div></div></main><footer>Related skills use truncate">frontend-design</span> too but are ignored.</footer>
`;

/** Build a fetch stub that maps URLs to { status, body }. */
function stubFetch(routes: Record<string, { status?: number; body: string }>): FetchLike {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = Object.entries(routes).find(([key]) => url.includes(key));
    if (!match) return new Response("not found", { status: 404 });
    const { status = 200, body } = match[1];
    return new Response(body, { status });
  }) as FetchLike;
}

describe("isGithubSource", () => {
  it("accepts owner/repo and rejects domains or nested paths", () => {
    expect(isGithubSource("vercel-labs/agent-skills")).toBe(true);
    expect(isGithubSource("open.feishu.cn")).toBe(false);
    expect(isGithubSource("owner/repo/extra")).toBe(false);
  });
});

describe("isSafeInstallArg", () => {
  it("accepts plain owner/repo and owner/repo@skill", () => {
    expect(isSafeInstallArg("vercel-labs/agent-skills")).toBe(true);
    expect(isSafeInstallArg("vercel-labs/agent-skills@web-design-guidelines")).toBe(true);
  });

  it("rejects shell metacharacters, spaces, and extra segments", () => {
    expect(isSafeInstallArg("owner/repo@x&&calc")).toBe(false);
    expect(isSafeInstallArg("owner/repo@a|b")).toBe(false);
    expect(isSafeInstallArg("owner/repo@a b")).toBe(false);
    expect(isSafeInstallArg("owner/repo@slug@extra")).toBe(false);
  });
});

describe("toInstallArg", () => {
  it("joins source and slug with @", () => {
    expect(toInstallArg("vercel-labs/agent-skills", "web-design-guidelines")).toBe(
      "vercel-labs/agent-skills@web-design-guidelines",
    );
  });
});

describe("parseAudits", () => {
  it("extracts each provider and status, ignoring markup after </main>", () => {
    const audits = parseAudits(AUDIT_HTML);
    expect(audits).toEqual([
      { provider: "Gen Agent Trust Hub", status: "pass" },
      { provider: "Socket", status: "pass" },
      { provider: "Snyk", status: "warn" },
    ]);
  });

  it("returns [] when there is no audit section", () => {
    expect(parseAudits("<main>no audits here</main>")).toEqual([]);
  });
});

describe("verdictFromAudits", () => {
  it("is unaudited with no audits", () => {
    expect(verdictFromAudits([])).toBe("unaudited");
  });

  it("is pass only when every audit passes", () => {
    expect(verdictFromAudits([{ provider: "a", status: "pass" }])).toBe("pass");
  });

  it("downgrades to warn on any warning and fail on any failure", () => {
    expect(verdictFromAudits([{ provider: "a", status: "pass" }, { provider: "b", status: "warn" }])).toBe("warn");
    expect(verdictFromAudits([{ provider: "a", status: "warn" }, { provider: "b", status: "fail" }])).toBe("fail");
  });
});

describe("searchSkills", () => {
  it("parses results and applies the limit", async () => {
    const body = JSON.stringify({
      skills: [
        { id: "a/b/one", skillId: "one", name: "one", installs: 10, source: "a/b" },
        { id: "a/b/two", skillId: "two", name: "two", installs: 20, source: "a/b" },
      ],
    });
    const fetchImpl = stubFetch({ "/api/search": { body } });
    const results = await searchSkills("anything", 1, fetchImpl);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("a/b/one");
  });

  it("throws on a non-200 response", async () => {
    const fetchImpl = stubFetch({ "/api/search": { status: 500, body: "boom" } });
    await expect(searchSkills("x", 5, fetchImpl)).rejects.toThrow(/HTTP 500/);
  });
});

describe("gatherCandidates", () => {
  it("keeps popular GitHub skills, drops low-install and non-GitHub, and attaches verdicts", async () => {
    const search = JSON.stringify({
      skills: [
        { id: "vercel-labs/agent-skills/web-design-guidelines", skillId: "web-design-guidelines", name: "web-design-guidelines", installs: 435612, source: "vercel-labs/agent-skills" },
        { id: "some/repo/tiny", skillId: "tiny", name: "tiny", installs: 5, source: "some/repo" },
        { id: "open.feishu.cn/lark", skillId: "lark", name: "lark", installs: 99999, source: "open.feishu.cn" },
      ],
    });
    const fetchImpl = stubFetch({
      "/api/search": { body: search },
      "/vercel-labs/agent-skills/web-design-guidelines": { body: AUDIT_HTML },
    });

    const candidates = await gatherCandidates("web design", { minInstalls: 1000, limit: 20, fetchImpl });
    expect(candidates).toHaveLength(1);
    const only = candidates[0]!;
    expect(only.installArg).toBe("vercel-labs/agent-skills@web-design-guidelines");
    expect(only.verdict).toBe("warn");
    expect(only.audits).toHaveLength(3);
  });

  it("drops listings whose id would not survive the shell unquoted", async () => {
    const search = JSON.stringify({
      skills: [
        { id: "evil/repo/x", skillId: "x&&calc", name: "evil", installs: 50000, source: "evil/repo" },
        { id: "good/repo/fine", skillId: "fine", name: "fine", installs: 50000, source: "good/repo" },
        { id: "bad/repo/nul", name: "no-slug", installs: 50000, source: "bad/repo" },
      ],
    });
    const fetchImpl = stubFetch({
      "/api/search": { body: search },
      "/good/repo/fine": { body: AUDIT_HTML },
    });

    const candidates = await gatherCandidates("anything", { minInstalls: 1000, limit: 20, fetchImpl });
    expect(candidates.map((c) => c.installArg)).toEqual(["good/repo@fine"]);
  });
});
