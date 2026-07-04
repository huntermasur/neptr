/**
 * Thin client for the public skillful.sh REST API, used by `neptr mcp`.
 *
 * Unlike skills.sh, skillful.sh ships a documented JSON API, so no scraping:
 *   - `GET /api/v1/items?type=mcp_server&search=…` lists matching MCP servers
 *     (summary fields only — no security score).
 *   - `GET /api/v1/items/:slug` returns the full item including `securityScore`
 *     (letter grade + 0-100 score) once skillful has scanned it.
 *
 * Anonymous requests are rate-limited to 20/min, 500/day, so we keep the
 * per-run request count modest (one search + one detail fetch per candidate).
 */

const BASE = "https://skillful.sh";

/**
 * skillful.sh sits behind a WAF that 403s bare CLI user-agents, so we present a
 * browser-like UA (with a neptr-cli marker) to reach the public JSON API.
 */
const USER_AGENT = "Mozilla/5.0 (compatible; neptr-cli; +https://github.com/neptr)";

/** Injectable fetch so tests can run without hitting the network. */
export type FetchLike = typeof fetch;

/** Package registry an MCP server is published to (drives the launch command). */
export type PackageRegistry = "npm" | "pypi" | "other";

/** One MCP server from the list/search endpoint (no security score). */
export interface McpSearchResult {
  /** URL-safe identifier, used for the detail lookup and as the `.mcp.json` key. */
  slug: string;
  /** Human-readable / package name. */
  name: string;
  description: string;
  author: string;
  /** Published package id (e.g. `@playwright/mcp`, `markitdown`), when known. */
  packageName?: string;
  registry: PackageRegistry;
  repositoryUrl?: string;
  license?: string;
  stars: number;
  weeklyDownloads: number;
  /** How many directories list this server (a rough popularity signal). */
  directoryCount: number;
}

/** Letter grades skillful assigns after scanning a server. */
export type SecurityGrade = "A+" | "A" | "B" | "C" | "D" | "F";

/** Overall verdict derived from the security grade relative to the threshold. */
export type SecurityVerdict = "pass" | "warn" | "fail" | "unscored";

/** A `.mcp.json` server entry NEPTR can write for a selected server. */
export interface McpServerConfig {
  type: "stdio";
  command: string;
  args: string[];
}

/** A search result enriched with its security score and a launch config. */
export interface McpCandidate extends McpSearchResult {
  grade: SecurityGrade | null;
  score: number | null;
  verdict: SecurityVerdict;
  /** stdio config for `.mcp.json`, or null when we cannot derive a launch command. */
  serverConfig: McpServerConfig | null;
}

/** Ordering of grades, high to low, for threshold comparisons. */
const GRADE_RANK: Record<SecurityGrade, number> = { "A+": 6, A: 5, B: 4, C: 3, D: 2, F: 1 };

/** Valid `--min-grade` values (highest to lowest). */
export const GRADES: SecurityGrade[] = ["A+", "A", "B", "C", "D", "F"];

async function fetchJson(url: string, fetchImpl: FetchLike, timeoutMs = 15_000): Promise<{ status: number; json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });
    const text = await res.text();
    let json: unknown = undefined;
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

/** Normalize skillful's `packageRegistry` string into our union. */
export function normalizeRegistry(raw: unknown): PackageRegistry {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  if (value === "npm") return "npm";
  if (value === "pypi") return "pypi";
  return "other";
}

/** Shape one raw skillful item into an `McpSearchResult`, or null if unusable. */
function toSearchResult(raw: unknown): McpSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const slug = typeof item.slug === "string" ? item.slug : "";
  const name = typeof item.name === "string" ? item.name : slug;
  if (!slug) return null;
  const stats = (item.stats && typeof item.stats === "object" ? item.stats : {}) as Record<string, unknown>;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    slug,
    name,
    description: typeof item.description === "string" ? item.description : "",
    author: typeof item.author === "string" ? item.author : "",
    packageName: typeof item.packageName === "string" ? item.packageName : undefined,
    registry: normalizeRegistry(item.packageRegistry),
    repositoryUrl: typeof item.repositoryUrl === "string" ? item.repositoryUrl : undefined,
    license: typeof item.license === "string" ? item.license : undefined,
    stars: num(stats.githubStars),
    weeklyDownloads: num(stats.npmWeeklyDownloads) || num(stats.pypiMonthlyDownloads),
    directoryCount: num(stats.directoryCount),
  };
}

/** Turn a non-200 status into a friendly, actionable message. */
function describeHttpError(status: number, service: string): string {
  if (status === 429) return `${service} is rate-limiting us (HTTP 429). Wait a minute, then try again.`;
  if (status >= 500) return `${service} had a server error (HTTP ${status}). Try again shortly.`;
  return `${service} search returned HTTP ${status}`;
}

/**
 * Search skillful.sh for MCP servers matching `query`, most-starred first.
 * Throws on a non-200 response or malformed JSON so the caller can report it.
 */
export async function searchMcpServers(query: string, limit: number, fetchImpl: FetchLike = fetch): Promise<McpSearchResult[]> {
  const url = `${BASE}/api/v1/items?type=mcp_server&search=${encodeURIComponent(query)}&sort=stars&limit=${Math.max(1, limit)}`;
  const { status, json } = await fetchJson(url, fetchImpl);
  if (status !== 200) {
    throw new Error(describeHttpError(status, "skillful.sh"));
  }
  const items = json && typeof json === "object" ? (json as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) {
    throw new Error("skillful.sh search returned a response NEPTR could not read");
  }
  return items.map(toSearchResult).filter((r): r is McpSearchResult => r !== null).slice(0, Math.max(0, limit));
}

/** True when `raw` is one of skillful's letter grades. */
function asGrade(raw: unknown): SecurityGrade | null {
  return typeof raw === "string" && (GRADES as string[]).includes(raw) ? (raw as SecurityGrade) : null;
}

/**
 * Fetch a single server's security score from the detail endpoint. Returns null
 * when the server has not been scanned yet, or on any network/parse error.
 */
export async function fetchSecurityScore(
  slug: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ grade: SecurityGrade | null; score: number | null }> {
  try {
    const { status, json } = await fetchJson(`${BASE}/api/v1/items/${encodeURIComponent(slug)}`, fetchImpl);
    if (status !== 200 || !json || typeof json !== "object") return { grade: null, score: null };
    const security = (json as { securityScore?: unknown }).securityScore;
    if (!security || typeof security !== "object") return { grade: null, score: null };
    const s = security as Record<string, unknown>;
    return {
      grade: asGrade(s.grade),
      score: typeof s.overallScore === "number" ? s.overallScore : null,
    };
  } catch {
    return { grade: null, score: null };
  }
}

/** Whether `grade` meets or beats `minGrade`. Unscored (null) never passes. */
export function gradeMeets(grade: SecurityGrade | null, minGrade: SecurityGrade): boolean {
  if (grade === null) return false;
  return GRADE_RANK[grade] >= GRADE_RANK[minGrade];
}

/**
 * Derive a verdict from a grade relative to the threshold:
 *   - no grade yet  → "unscored"
 *   - meets minGrade → "pass"
 *   - D or F         → "fail"
 *   - otherwise      → "warn" (scored, but below the bar)
 */
export function verdictFromGrade(grade: SecurityGrade | null, minGrade: SecurityGrade): SecurityVerdict {
  if (grade === null) return "unscored";
  if (gradeMeets(grade, minGrade)) return "pass";
  if (grade === "D" || grade === "F") return "fail";
  return "warn";
}

/**
 * Build the `.mcp.json` launch config for a server from its package registry.
 * npm packages run via `npx -y <pkg>`, PyPI packages via `uvx <pkg>`. Anything
 * else (or a missing package name) yields null — we cannot guess a command.
 */
export function deriveServerConfig(packageName: string | undefined, registry: PackageRegistry): McpServerConfig | null {
  if (!packageName) return null;
  if (registry === "npm") return { type: "stdio", command: "npx", args: ["-y", packageName] };
  if (registry === "pypi") return { type: "stdio", command: "uvx", args: [packageName] };
  return null;
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

export interface GatherMcpOptions {
  /** Max number of servers to fetch security scores for (and offer to the user). */
  limit: number;
  /** Grade threshold used to compute each candidate's verdict. */
  minGrade: SecurityGrade;
  fetchImpl?: FetchLike;
}

/**
 * Search skillful.sh, take the top `limit` MCP servers, then enrich each with
 * its security score (fetched concurrently) and a launch config.
 */
export async function gatherMcpCandidates(query: string, options: GatherMcpOptions): Promise<McpCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = await searchMcpServers(query, options.limit, fetchImpl);
  // Keep concurrency low to respect skillful.sh's 20 requests/minute anon limit.
  const scores = await mapPool(results, 4, (r) => fetchSecurityScore(r.slug, fetchImpl));
  return results.map((r, i) => {
    const { grade, score } = scores[i] ?? { grade: null, score: null };
    return {
      ...r,
      grade,
      score,
      verdict: verdictFromGrade(grade, options.minGrade),
      serverConfig: deriveServerConfig(r.packageName, r.registry),
    };
  });
}
