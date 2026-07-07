/**
 * Client for the official Model Context Protocol registry
 * (https://registry.modelcontextprotocol.io), used by `neptr mcp`.
 *
 * This is the upstream registry that GitHub's `github.com/mcp` registry mirrors,
 * and the only one with a stable, documented public JSON API:
 *   - `GET /v0/servers?search=…&version=latest&limit=…` lists matching servers,
 *     each already carrying its repository, packages (npm/pypi/oci), version, and
 *     a registry-verified reverse-DNS namespace (e.g. `com.stripe/…`).
 *
 * Unlike skillful.sh there is no third-party security grade — NEPTR computes its
 * own verdict from the registry metadata plus a light GitHub repo-activity probe
 * (see `verifyServer` / `fetchRepoActivity`).
 */

import fs from "node:fs";
import path from "node:path";

const BASE = "https://registry.modelcontextprotocol.io";
const GITHUB_API = "https://api.github.com";

/** Injectable fetch so tests can run without hitting the network. */
export type FetchLike = typeof fetch;

/** Package registry a server is published to (drives the launch command). */
export type RegistryType = "npm" | "pypi" | "oci" | "other";

/** One publishable package for a server (npm/pypi/oci). */
export interface McpPackage {
  registryType: RegistryType;
  /** Package id: `@playwright/mcp`, `markitdown`, `owner/img:tag`. */
  identifier: string;
  /** Concrete published version — what we pin to. */
  version?: string;
  /** Suggested runner (`npx`, `uvx`, `docker`), when the registry provides one. */
  runtimeHint?: string;
  /** Whether the package declares any (likely secret) environment variables. */
  hasEnvVars: boolean;
}

/** A remote (hosted) endpoint for a server. */
export interface McpRemote {
  type: string;
  url: string;
}

/** One server as returned by the registry `/v0/servers` endpoint. */
export interface RegistryServer {
  /** Reverse-DNS namespace + name, e.g. `io.github.owner/name`, `com.stripe/api`. */
  name: string;
  description: string;
  version?: string;
  repositoryUrl?: string;
  packages: McpPackage[];
  remotes: McpRemote[];
  /** Registry lifecycle status (`active`, `deprecated`, …), from `_meta`. */
  status?: string;
  /** ISO timestamp of the last registry update, from `_meta`. */
  updatedAt?: string;
}

/** A single safety check NEPTR runs against the user's criteria. */
export interface Check {
  id: "vendor" | "activity" | "issues" | "access" | "runnable" | "version";
  label: string;
  status: "ok" | "warn" | "unknown";
  detail: string;
}

/** Overall verdict derived from every check on a server. */
export type Verdict = "safe" | "caution" | "avoid";

/** A `.mcp.json` server entry NEPTR can write for a selected server. */
export type McpServerConfig = { type: "stdio"; command: string; args: string[] } | { type: "http"; url: string };

/** The result of verifying one server: the checklist plus the rolled-up verdict. */
export interface Verification {
  checks: Check[];
  verdict: Verdict;
  /** True when the winning package declares (likely secret) env vars. */
  needsSecret: boolean;
}

/** A registry server enriched with its verification and a launch config. */
export interface McpCandidate extends RegistryServer {
  verification: Verification;
  /** Config for `.mcp.json`, or null when we cannot derive a launch command. */
  serverConfig: McpServerConfig | null;
  /** Outcome of the GitHub repo-activity probe: `failed` means the server has a
   *  GitHub repo but the lookup failed (network error / rate limit), so its
   *  verdict may read "caution" for lack of evidence rather than real risk. */
  activityProbe: "ok" | "failed" | "none";
}

async function fetchJson(
  url: string,
  fetchImpl: FetchLike,
  headers: Record<string, string> = {},
  timeoutMs = 15_000,
): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "neptr-cli", accept: "application/json", ...headers },
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** Turn a non-200 status into a friendly, actionable message. */
function describeHttpError(status: number, service: string): string {
  if (status === 429) return `${service} is rate-limiting us (HTTP 429). Wait a minute, then try again.`;
  if (status >= 500) return `${service} had a server error (HTTP ${status}). Try again shortly.`;
  return `${service} search returned HTTP ${status}`;
}

/** Normalize the registry's `registryType`/`registry_name` into our union. */
export function normalizeRegistry(raw: unknown): RegistryType {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  if (value === "npm") return "npm";
  if (value === "pypi") return "pypi";
  if (value === "oci" || value === "docker") return "oci";
  return "other";
}

/** Shape one raw package entry, or null if it lacks an identifier. */
function toPackage(raw: unknown): McpPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const pkg = raw as Record<string, unknown>;
  const identifier = typeof pkg.identifier === "string" ? pkg.identifier : "";
  if (!identifier) return null;
  const env = pkg.environmentVariables;
  return {
    registryType: normalizeRegistry(pkg.registryType ?? pkg.registry_name),
    identifier,
    version: typeof pkg.version === "string" ? pkg.version : undefined,
    runtimeHint: typeof pkg.runtimeHint === "string" ? pkg.runtimeHint : undefined,
    hasEnvVars: Array.isArray(env) && env.length > 0,
  };
}

/** Shape one raw `servers[]` entry (the `{ server, _meta }` envelope). */
function toRegistryServer(raw: unknown): RegistryServer | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as Record<string, unknown>;
  const server = (envelope.server && typeof envelope.server === "object" ? envelope.server : envelope) as Record<
    string,
    unknown
  >;
  const name = typeof server.name === "string" ? server.name : "";
  if (!name) return null;

  const repository = (server.repository && typeof server.repository === "object" ? server.repository : {}) as Record<
    string,
    unknown
  >;
  const packages = Array.isArray(server.packages)
    ? server.packages.map(toPackage).filter((p): p is McpPackage => p !== null)
    : [];
  const remotes = Array.isArray(server.remotes)
    ? server.remotes
        .map((r): McpRemote | null => {
          if (!r || typeof r !== "object") return null;
          const remote = r as Record<string, unknown>;
          const url = typeof remote.url === "string" ? remote.url : "";
          if (!url) return null;
          return { type: typeof remote.type === "string" ? remote.type : "http", url };
        })
        .filter((r): r is McpRemote => r !== null)
    : [];

  const meta = (envelope._meta && typeof envelope._meta === "object" ? envelope._meta : {}) as Record<string, unknown>;
  const official = meta["io.modelcontextprotocol.registry/official"];
  const officialMeta = (official && typeof official === "object" ? official : {}) as Record<string, unknown>;

  return {
    name,
    description: typeof server.description === "string" ? server.description : "",
    version: typeof server.version === "string" ? server.version : undefined,
    repositoryUrl: typeof repository.url === "string" ? repository.url : undefined,
    packages,
    remotes,
    status: typeof officialMeta.status === "string" ? officialMeta.status : undefined,
    updatedAt: typeof officialMeta.updatedAt === "string" ? officialMeta.updatedAt : undefined,
  };
}

/**
 * Search the MCP registry for servers matching `query`. Throws on a non-200
 * response or malformed JSON so the caller can report it.
 */
export async function searchMcpServers(
  query: string,
  limit: number,
  fetchImpl: FetchLike = fetch,
): Promise<RegistryServer[]> {
  const url = `${BASE}/v0/servers?search=${encodeURIComponent(query)}&version=latest&limit=${Math.max(1, limit)}`;
  const { status, json } = await fetchJson(url, fetchImpl);
  if (status !== 200) {
    throw new Error(describeHttpError(status, "the MCP registry"));
  }
  const servers = json && typeof json === "object" ? (json as { servers?: unknown }).servers : undefined;
  if (!Array.isArray(servers)) {
    throw new Error("the MCP registry returned a response NEPTR could not read");
  }
  return servers
    .map(toRegistryServer)
    .filter((s): s is RegistryServer => s !== null)
    .slice(0, Math.max(0, limit));
}

/** Pick the package NEPTR would launch: prefer local runners (npm/pypi), then oci. */
export function pickPackage(server: RegistryServer): McpPackage | undefined {
  return (
    server.packages.find((p) => p.registryType === "npm" || p.registryType === "pypi") ??
    server.packages.find((p) => p.registryType === "oci") ??
    server.packages[0]
  );
}

/**
 * Build the `.mcp.json` launch config for a server, pinning the exact package
 * version (never `@latest`). npm → `npx -y <id>@<ver>`, PyPI → `uvx <id>@<ver>`,
 * OCI → `docker run -i --rm <id>`. A server with only remotes yields an http
 * entry. Anything else yields null — we cannot guess a command.
 */
export function deriveServerConfig(server: RegistryServer): McpServerConfig | null {
  const pkg = pickPackage(server);
  if (pkg && pkg.registryType !== "other") {
    const pinned = pkg.version ? `${pkg.identifier}@${pkg.version}` : pkg.identifier;
    if (pkg.registryType === "npm") return { type: "stdio", command: "npx", args: ["-y", pinned] };
    if (pkg.registryType === "pypi") return { type: "stdio", command: "uvx", args: [pinned] };
    if (pkg.registryType === "oci")
      return { type: "stdio", command: "docker", args: ["run", "-i", "--rm", pkg.identifier] };
  }
  const remote = server.remotes[0];
  if (remote) return { type: "http", url: remote.url };
  return null;
}

// --- Verifier ------------------------------------------------------------

/**
 * Reverse-DNS namespace prefixes NEPTR treats as first-party vendors. The
 * registry verifies namespace ownership (DNS for `com.*`, GitHub identity for
 * `io.github.*`), so a match here means the publisher provably controls it.
 */
const KNOWN_VENDORS: Record<string, string> = {
  "io.github.github": "GitHub",
  "com.github": "GitHub",
  "io.github.microsoft": "Microsoft",
  "com.microsoft": "Microsoft",
  "io.github.cloudflare": "Cloudflare",
  "com.cloudflare": "Cloudflare",
  "com.stripe": "Stripe",
  "io.github.stripe": "Stripe",
  "ai.notion": "Notion",
  "com.notion": "Notion",
  "com.anthropic": "Anthropic",
  "io.github.anthropics": "Anthropic",
  "com.google": "Google",
  "io.github.googleapis": "Google",
  "com.amazon": "AWS",
  "com.amazonaws": "AWS",
  "io.github.awslabs": "AWS",
  "com.atlassian": "Atlassian",
  "com.sentry": "Sentry",
  "io.github.getsentry": "Sentry",
};

/** Keyword groups that flag broad or sensitive access surfaces. */
const ACCESS_SCOPES: Array<{ scope: string; re: RegExp }> = [
  { scope: "filesystem", re: /\bfile\s?system|\bfiles?\b|directory|\bfs\b/i },
  { scope: "shell", re: /\bshell\b|\bexec\b|command line|terminal|\bbash\b|subprocess/i },
  { scope: "browser", re: /\bbrowser\b|playwright|puppeteer|chromium|\bpage\b/i },
  { scope: "email", re: /\bemail\b|\bsmtp\b|\bimap\b|\bmail\b/i },
  { scope: "github", re: /\bgithub\b|\bgit\b|pull request|repository/i },
  { scope: "database", re: /database|\bsql\b|postgres|mysql|sqlite|mongo/i },
];

/**
 * Split a registry name (`io.github.owner/server`) into its namespace prefix
 * (`io.github.owner`) and the trailing GitHub owner when it is a `io.github.*`
 * name (`owner`).
 */
export function parseNamespace(name: string): { prefix: string; githubOwner?: string } {
  const prefix = name.includes("/") ? name.slice(0, name.indexOf("/")) : name;
  const gh = /^io\.github\.([^./]+)/i.exec(prefix);
  return { prefix, githubOwner: gh ? gh[1] : undefined };
}

/** Criterion 1 — is this from a real, namespace-verified vendor? */
export function checkVendor(name: string): Check {
  const { prefix, githubOwner } = parseNamespace(name);
  const vendor = KNOWN_VENDORS[prefix.toLowerCase()];
  if (vendor) {
    return { id: "vendor", label: "Publisher", status: "ok", detail: `verified vendor: ${vendor}` };
  }
  if (githubOwner) {
    return {
      id: "vendor",
      label: "Publisher",
      status: "warn",
      detail: `community (namespace-verified GitHub: ${githubOwner})`,
    };
  }
  return { id: "vendor", label: "Publisher", status: "warn", detail: `community namespace: ${prefix}` };
}

/** Criterion 4 — does it ask for broad filesystem/shell/browser/etc. access? */
export function checkBroadAccess(server: RegistryServer): Check {
  // Scan the human-facing name segment (not the reverse-DNS prefix, which for
  // `io.github.*` names always contains "github" and would false-positive).
  const nameSegment = server.name.includes("/") ? server.name.slice(server.name.indexOf("/") + 1) : "";
  const haystack = [nameSegment, server.description, ...server.packages.map((p) => p.identifier)].join(" ");
  const scopes = ACCESS_SCOPES.filter((s) => s.re.test(haystack)).map((s) => s.scope);
  if (scopes.length === 0) {
    return { id: "access", label: "Access surface", status: "ok", detail: "no broad-access keywords" };
  }
  return {
    id: "access",
    label: "Access surface",
    status: "warn",
    detail: `touches ${scopes.join(", ")} — scope credentials to read-only where possible`,
  };
}

/** Criterion 6 — can we run it locally or in Docker (vs. remote-only)? */
export function checkRunnable(server: RegistryServer): Check {
  const pkg = pickPackage(server);
  if (pkg?.registryType === "npm" || pkg?.registryType === "pypi") {
    return { id: "runnable", label: "Runs locally", status: "ok", detail: `local (${pkg.registryType})` };
  }
  if (pkg?.registryType === "oci") {
    return { id: "runnable", label: "Runs locally", status: "ok", detail: "local via Docker" };
  }
  if (server.remotes.length > 0) {
    return { id: "runnable", label: "Runs locally", status: "warn", detail: "remote-only (hosted endpoint)" };
  }
  return { id: "runnable", label: "Runs locally", status: "unknown", detail: "no runnable package listed" };
}

/** Criterion 7 — can we pin an exact version instead of pulling latest? */
export function checkVersionPin(server: RegistryServer): Check {
  const pkg = pickPackage(server);
  if (pkg?.version) {
    return { id: "version", label: "Version pinning", status: "ok", detail: `pinned to ${pkg.version}` };
  }
  // Many OCI listings (e.g. GitHub's official server) omit the version field
  // but carry it in the image tag — an explicit non-latest tag is a pin.
  if (pkg?.registryType === "oci") {
    const tag = /:([\w][\w.-]*)$/.exec(pkg.identifier)?.[1];
    if (tag && tag.toLowerCase() !== "latest") {
      return { id: "version", label: "Version pinning", status: "ok", detail: `pinned to image tag ${tag}` };
    }
  }
  return {
    id: "version",
    label: "Version pinning",
    status: "warn",
    detail: "no concrete version — would track latest",
  };
}

/** GitHub repo facts used for the activity/issues criteria. */
export interface RepoActivity {
  pushedAt: string | null;
  archived: boolean;
  openIssues: number;
}

/** Roughly one year, in milliseconds, for the "recent commits" threshold. */
const STALE_AFTER_MS = 365 * 24 * 60 * 60 * 1000;
/** Above this open-issue count we flag a possible unaddressed backlog. */
const BUSY_ISSUE_COUNT = 150;

/** Criterion 2 — recent commits/releases (archived is a hard fail signal). */
export function checkActivity(activity: RepoActivity | null): Check {
  if (!activity) return { id: "activity", label: "Repo activity", status: "unknown", detail: "could not reach GitHub" };
  if (activity.archived)
    return { id: "activity", label: "Repo activity", status: "warn", detail: "repository is archived" };
  if (!activity.pushedAt) return { id: "activity", label: "Repo activity", status: "unknown", detail: "no push date" };
  const ageMs = Date.now() - new Date(activity.pushedAt).getTime();
  if (Number.isFinite(ageMs) && ageMs > STALE_AFTER_MS) {
    return {
      id: "activity",
      label: "Repo activity",
      status: "warn",
      detail: `no push in over a year (${activity.pushedAt.slice(0, 10)})`,
    };
  }
  return {
    id: "activity",
    label: "Repo activity",
    status: "ok",
    detail: `last push ${activity.pushedAt.slice(0, 10)}`,
  };
}

/** Criterion 3 — a large open-issue backlog that may signal poor maintenance. */
export function checkIssues(activity: RepoActivity | null): Check {
  if (!activity) return { id: "issues", label: "Issue backlog", status: "unknown", detail: "could not reach GitHub" };
  if (activity.openIssues > BUSY_ISSUE_COUNT) {
    return { id: "issues", label: "Issue backlog", status: "warn", detail: `${activity.openIssues} open issues/PRs` };
  }
  return { id: "issues", label: "Issue backlog", status: "ok", detail: `${activity.openIssues} open issues/PRs` };
}

/**
 * Run every criterion and roll the checks up into a verdict. Broad access is
 * inherent to many useful servers (a DB or browser tool *must* touch that
 * surface), so it is reported as a "scope your credentials" reminder rather than
 * a gate. The verdict weighs the risk-reducing signals instead:
 *   - `avoid`  — the repo is archived (don't install without a deliberate opt-in).
 *   - `safe`   — runs locally *and* pins a version *and* isn't stale, plus a trust
 *                anchor: either a verified vendor or a maintained (active) repo.
 *   - `caution` — anything weaker: remote-only, no version, community + unknown
 *                 activity, a stale repo, etc. Shown only with --include-unverified.
 */
export function verifyServer(server: RegistryServer, activity: RepoActivity | null): Verification {
  const vendor = checkVendor(server.name);
  const active = checkActivity(activity);
  const issues = checkIssues(activity);
  const access = checkBroadAccess(server);
  const runnable = checkRunnable(server);
  const version = checkVersionPin(server);
  const checks: Check[] = [vendor, active, issues, access, runnable, version];

  let verdict: Verdict;
  if (activity?.archived) {
    verdict = "avoid";
  } else if (
    runnable.status === "ok" &&
    version.status === "ok" &&
    active.status !== "warn" && // not stale (archived already handled above)
    (vendor.status === "ok" || active.status === "ok")
  ) {
    verdict = "safe";
  } else {
    verdict = "caution";
  }

  const pkg = pickPackage(server);
  return { checks, verdict, needsSecret: Boolean(pkg?.hasEnvVars) };
}

/** Parse `owner/repo` out of a GitHub repository URL, if it is one. */
export function parseGithubRepo(repositoryUrl: string | undefined): { owner: string; repo: string } | null {
  if (!repositoryUrl) return null;
  const m = /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(repositoryUrl);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]! };
}

/**
 * Fetch a repo's activity from the GitHub API. Returns null on any
 * non-GitHub URL, network error, or non-200 (e.g. rate limit) so the caller can
 * degrade to an "unknown" verdict instead of failing.
 */
export async function fetchRepoActivity(
  repositoryUrl: string | undefined,
  fetchImpl: FetchLike = fetch,
  token?: string,
): Promise<RepoActivity | null> {
  const parsed = parseGithubRepo(repositoryUrl);
  if (!parsed) return null;
  try {
    const headers: Record<string, string> = { accept: "application/vnd.github+json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const { status, json } = await fetchJson(`${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}`, fetchImpl, headers);
    if (status !== 200 || !json || typeof json !== "object") return null;
    const repo = json as Record<string, unknown>;
    return {
      pushedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
      archived: repo.archived === true,
      openIssues: typeof repo.open_issues_count === "number" ? repo.open_issues_count : 0,
    };
  } catch {
    return null;
  }
}

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      results[index] = await fn(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * How many servers to pull from the registry before ranking locally. The
 * registry's search is an unranked substring match returned in rough namespace
 * order, so truncating at the display limit would keep the alphabetically
 * first servers and bury well-known ones further down the list.
 */
const SEARCH_POOL = 100;

/**
 * Order a search pool by registry metadata alone (no network calls): verified
 * vendors first, then locally runnable and version-pinned servers; anything
 * the registry no longer marks `active` sinks. Stable, so the registry's own
 * order breaks ties.
 */
export function rankServers(servers: RegistryServer[]): RegistryServer[] {
  const score = (s: RegistryServer): number => {
    let n = 0;
    if (checkVendor(s.name).status === "ok") n += 4;
    if (checkRunnable(s).status === "ok") n += 2;
    if (checkVersionPin(s).status === "ok") n += 1;
    if (s.status && s.status !== "active") n -= 8;
    return n;
  };
  return servers
    .map((server, index) => ({ server, index, score: score(server) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.server);
}

/**
 * A query that names a known vendor (e.g. "github", "stripe") is usually after
 * that vendor's official server, but the registry's substring search buries
 * it: "github" matches every `io.github.*` namespace, so even a large pool
 * fills up with alphabetically earlier community servers. Query the matching
 * vendor namespaces directly and merge the results into the pool.
 */
async function searchKnownVendors(query: string, fetchImpl: FetchLike): Promise<RegistryServer[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const prefixes = Object.entries(KNOWN_VENDORS)
    .filter(([, vendor]) => vendor.toLowerCase().includes(q))
    .map(([prefix]) => prefix);
  if (prefixes.length === 0) return [];
  const batches = await Promise.all(prefixes.map((prefix) => searchMcpServers(prefix, 20, fetchImpl).catch(() => [])));
  return batches.flat();
}

/** Cached activity entries expire after an hour — long enough to span a plan
 *  session's `--search-only` → `--yes` double pass without re-spending the
 *  GitHub rate limit, short enough to notice a repo being archived. */
const ACTIVITY_CACHE_TTL_MS = 60 * 60 * 1000;

type ActivityCache = Record<string, { activity: RepoActivity; fetchedAt: string }>;

function readActivityCache(file: string): ActivityCache {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ActivityCache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export interface GatherMcpOptions {
  /** Max number of servers to verify and offer to the user (the search pool
   *  is larger — see SEARCH_POOL — and ranked before this cut). */
  limit: number;
  fetchImpl?: FetchLike;
  /** Optional GitHub token to raise the 60/hr anonymous rate limit. */
  githubToken?: string;
  /** Directory for the GitHub-activity cache file; omit to skip caching. */
  cacheDir?: string;
}

/**
 * Search the registry, rank the pool locally, then verify the top `limit`
 * servers against the safety criteria — fetching GitHub repo activity
 * concurrently (kept low to respect the anon rate limit, and cached on disk
 * across invocations) and attaching a pinned launch config.
 */
export async function gatherMcpCandidates(query: string, options: GatherMcpOptions): Promise<McpCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const [pool, vendorPool] = await Promise.all([
    searchMcpServers(query, SEARCH_POOL, fetchImpl),
    searchKnownVendors(query, fetchImpl),
  ]);
  const seen = new Set<string>();
  const merged = [...vendorPool, ...pool].filter((s) => !seen.has(s.name) && Boolean(seen.add(s.name)));
  const servers = rankServers(merged).slice(0, Math.max(0, options.limit));

  const cacheFile = options.cacheDir ? path.join(options.cacheDir, "mcp-activity.json") : null;
  const cache = cacheFile ? readActivityCache(cacheFile) : {};
  const now = Date.now();

  const activities = await mapPool(servers, 4, async (s) => {
    const repo = parseGithubRepo(s.repositoryUrl);
    if (!repo) return null;
    const key = `${repo.owner}/${repo.repo}`;
    const hit = cache[key];
    if (hit && now - new Date(hit.fetchedAt).getTime() < ACTIVITY_CACHE_TTL_MS) return hit.activity;
    const activity = await fetchRepoActivity(s.repositoryUrl, fetchImpl, options.githubToken);
    if (activity) cache[key] = { activity, fetchedAt: new Date(now).toISOString() };
    return activity;
  });

  if (cacheFile && Object.keys(cache).length > 0) {
    try {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache));
    } catch {
      // The cache is best-effort; a read-only temp dir must not break search.
    }
  }

  return servers.map((server, i) => {
    const activity = activities[i] ?? null;
    const activityProbe: McpCandidate["activityProbe"] =
      parseGithubRepo(server.repositoryUrl) === null ? "none" : activity ? "ok" : "failed";
    return {
      ...server,
      verification: verifyServer(server, activity),
      serverConfig: deriveServerConfig(server),
      activityProbe,
    };
  });
}
