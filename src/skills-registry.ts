/**
 * Thin client for the public skills.sh surface, used by `neptr skill`.
 *
 * The documented `/api/v1/*` endpoints require a Vercel OIDC token that a local
 * CLI does not have, so we use the two surfaces that are reachable without auth:
 *   - `GET /api/search?q=…` returns JSON with install counts (public).
 *   - Each skill's public page server-renders its "Security Audits" section,
 *     which we scrape for the per-partner pass/warn/fail verdicts.
 */

const BASE = "https://www.skills.sh";

/** Injectable fetch so tests can run without hitting the network. */
export type FetchLike = typeof fetch;

/** One row from the search endpoint. */
export interface SkillSearchResult {
  /** Stable id, `source/slug` (e.g. `vercel-labs/agent-skills/web-design-guidelines`). */
  id: string;
  /** URL-safe skill slug. */
  skillId: string;
  /** Human-readable name. */
  name: string;
  /** Total deduplicated install count. */
  installs: number;
  /** Source repo/provider (`owner/repo` for GitHub, a domain for well-known). */
  source: string;
}

export type AuditStatus = "pass" | "warn" | "fail" | "unknown";

export interface AuditEntry {
  provider: string;
  status: AuditStatus;
}

/** Overall security verdict derived from every partner audit on a skill. */
export type SecurityVerdict = "pass" | "warn" | "fail" | "unaudited";

/** A search result enriched with its security audits and install command. */
export interface SkillCandidate extends SkillSearchResult {
  audits: AuditEntry[];
  verdict: SecurityVerdict;
  /** `owner/repo@slug` source to hand to `npx skills add`. */
  installArg: string;
}

async function fetchText(url: string, fetchImpl: FetchLike, timeoutMs = 15_000): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "user-agent": "neptr-cli", accept: "application/json, text/html" },
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/** True for GitHub `owner/repo` sources, which `npx skills add` installs by id. */
export function isGithubSource(source: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(source);
}

/** Build the `owner/repo@slug` argument for `npx skills add`. */
export function toInstallArg(source: string, skillId: string): string {
  return `${source}@${skillId}`;
}

/**
 * True when `arg` is a plain `owner/repo[@slug]` safe to place on an
 * `npx skills add` command line. On Windows that line goes through cmd.exe
 * unquoted, so registry-supplied ids must pass this allowlist before install —
 * a metacharacter in a hostile listing would otherwise execute.
 */
export function isSafeInstallArg(arg: string): boolean {
  return /^[\w.-]+\/[\w.-]+(@[\w.-]+)?$/.test(arg);
}

/** Turn a non-200 status into a friendly, actionable message. */
function describeHttpError(status: number, service: string): string {
  if (status === 429) return `${service} is rate-limiting us (HTTP 429). Wait a minute, then try again.`;
  if (status >= 500) return `${service} had a server error (HTTP ${status}). Try again shortly.`;
  return `${service} search returned HTTP ${status}`;
}

/**
 * Search skills.sh. Returns up to `limit` results ordered as the API ranks them.
 * Throws on a non-200 response or malformed JSON so the caller can report it.
 */
export async function searchSkills(query: string, limit: number, fetchImpl: FetchLike = fetch): Promise<SkillSearchResult[]> {
  const url = `${BASE}/api/search?q=${encodeURIComponent(query)}`;
  const { status, text } = await fetchText(url, fetchImpl);
  if (status !== 200) {
    throw new Error(describeHttpError(status, "skills.sh"));
  }
  let parsed: { skills?: SkillSearchResult[] };
  try {
    parsed = JSON.parse(text) as { skills?: SkillSearchResult[] };
  } catch {
    throw new Error("skills.sh search returned a response NEPTR could not read");
  }
  const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
  return skills
    .filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.skillId === "string" &&
        typeof s.source === "string" &&
        typeof s.name === "string" &&
        typeof s.installs === "number",
    )
    .slice(0, Math.max(0, limit));
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeStatus(raw: string): AuditStatus {
  switch (raw.trim().toLowerCase()) {
    case "pass":
      return "pass";
    case "warn":
      return "warn";
    case "fail":
      return "fail";
    default:
      return "unknown";
  }
}

/**
 * Parse the server-rendered "Security Audits" section out of a skill page.
 * Each audit renders as `…truncate">Provider</span><span …>Pass</span>`; we
 * only scan up to `</main>` so unrelated markup can never match.
 */
export function parseAudits(html: string): AuditEntry[] {
  const start = html.indexOf("Security Audits");
  if (start === -1) return [];
  const end = html.indexOf("</main>", start);
  const section = end === -1 ? html.slice(start) : html.slice(start, end);
  const entries: AuditEntry[] = [];
  const re = /truncate">([^<]+)<\/span><span[^>]*>(Pass|Warn|Fail)<\/span>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(section)) !== null) {
    const provider = decodeEntities((match[1] ?? "").trim());
    const status = normalizeStatus(match[2] ?? "");
    if (provider) entries.push({ provider, status });
  }
  return entries;
}

/** A skill is safe only if it has been audited and every partner passed. */
export function verdictFromAudits(audits: AuditEntry[]): SecurityVerdict {
  if (audits.length === 0) return "unaudited";
  if (audits.some((a) => a.status === "fail")) return "fail";
  if (audits.some((a) => a.status === "warn" || a.status === "unknown")) return "warn";
  return "pass";
}

/** Fetch and parse a single skill's audits. Network/parse errors yield []. */
export async function fetchAudits(id: string, fetchImpl: FetchLike = fetch): Promise<AuditEntry[]> {
  try {
    const { status, text } = await fetchText(`${BASE}/${id}`, fetchImpl);
    if (status !== 200) return [];
    return parseAudits(text);
  } catch {
    return [];
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

export interface GatherOptions {
  /** Only GitHub skills with at least this many installs are kept. */
  minInstalls: number;
  /** Max number of skills to fetch audits for (and offer to the user). */
  limit: number;
  fetchImpl?: FetchLike;
}

/**
 * Search, filter to installable GitHub skills over the install threshold, then
 * enrich the top `limit` with security audits (fetched concurrently).
 */
export async function gatherCandidates(query: string, options: GatherOptions): Promise<SkillCandidate[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = await searchSkills(query, 50, fetchImpl);
  const eligible = results
    .filter(
      (s) =>
        isGithubSource(s.source) &&
        s.installs >= options.minInstalls &&
        // Drop listings whose id would not survive the shell unquoted.
        isSafeInstallArg(toInstallArg(s.source, s.skillId)),
    )
    .slice(0, Math.max(0, options.limit));

  const audits = await mapPool(eligible, 6, (s) => fetchAudits(s.id, fetchImpl));

  return eligible.map((s, i) => {
    const a = audits[i] ?? [];
    return {
      ...s,
      audits: a,
      verdict: verdictFromAudits(a),
      installArg: toInstallArg(s.source, s.skillId),
    };
  });
}
