import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import { neptr } from "./theme.js";
import {
  gatherMcpCandidates,
  GRADES,
  type McpCandidate,
  type McpServerConfig,
  type SecurityGrade,
  type SecurityVerdict,
} from "./mcp-registry.js";

export interface McpFlags {
  limit?: string;
  minGrade?: string;
  /** Also show servers that are unscored or below the grade threshold. */
  includeUnverified?: boolean;
  /** List matching, security-checked servers without prompting or installing. */
  searchOnly?: boolean;
  /** Install every shown (grade-passing) server without prompting. */
  yes?: boolean;
}

const DEFAULT_LIMIT = 12;
const DEFAULT_MIN_GRADE: SecurityGrade = "A";

/** Parse a positive-integer flag, falling back to `fallback` when absent/invalid. */
function parseCount(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected a non-negative number, got "${raw}"`);
  return n;
}

/** Parse and validate a `--min-grade` value. */
function parseGrade(raw: string | undefined): SecurityGrade {
  if (raw === undefined) return DEFAULT_MIN_GRADE;
  const value = raw.trim().toUpperCase() as SecurityGrade;
  if (!GRADES.includes(value)) {
    throw new Error(`Unknown grade "${raw}". Valid grades: ${GRADES.join(", ")}`);
  }
  return value;
}

/** Render a download count as e.g. 435.6k / 2.3M for compact hints. */
export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function verdictBadge(c: McpCandidate): string {
  const grade = c.grade ? ` ${c.grade}` : "";
  switch (c.verdict) {
    case "pass":
      return pc.green(`✓ grade${grade}`);
    case "warn":
      return pc.yellow(`⚠ grade${grade}`);
    case "fail":
      return pc.red(`✘ grade${grade}`);
    case "unscored":
      return pc.dim("• not scanned yet");
  }
}

/** Short popularity hint shown next to each server. */
function popularityHint(c: McpCandidate): string {
  const bits: string[] = [];
  if (c.stars > 0) bits.push(`${formatDownloads(c.stars)}★`);
  if (c.weeklyDownloads > 0) bits.push(`${formatDownloads(c.weeklyDownloads)} dl`);
  if (bits.length === 0) bits.push(c.registry);
  return bits.join(" · ");
}

/**
 * Print the candidate servers without prompting or installing. Mirrors the
 * `neptr skill --search-only` planning mode so an agent can record servers.
 */
function reportSearchOnly(term: string, shown: McpCandidate[], total: number, includeUnverified: boolean): void {
  if (shown.length === 0) {
    neptr.warn(
      `Found ${total} MCP server(s) for "${term}", but none have passed the security bar yet. ` +
        `Re-run with --include-unverified to list them with their grade.`,
    );
    return;
  }
  console.log(pc.bold(`\nMCP servers matching "${term}" (${includeUnverified ? "all shown" : "grade-passing only"}):\n`));
  for (const c of shown) {
    console.log(`${verdictBadge(c)}  ${pc.bold(c.name)}  ${pc.dim(`${popularityHint(c)} · ${c.registry}`)}`);
    if (c.serverConfig) {
      console.log(`   install: ${pc.green(`neptr mcp "${term}" --yes`)}`);
    } else {
      console.log(`   ${pc.dim(`no auto-install (registry: ${c.registry}) — see ${c.repositoryUrl ?? "its repo"}`)}`);
    }
    console.log("");
  }
}

/** A sanitized, collision-free key for the `.mcp.json` mcpServers map. */
function serverKey(candidate: McpCandidate, taken: Set<string>): string {
  const base = (candidate.slug || candidate.name).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "mcp-server";
  let key = base;
  let i = 2;
  while (taken.has(key)) key = `${base}-${i++}`;
  taken.add(key);
  return key;
}

interface McpJson {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

/** Read the project's `.mcp.json`, tolerating a missing or malformed file. */
function readMcpJson(file: string): McpJson {
  if (!fs.existsSync(file)) return { mcpServers: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as McpJson;
    if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") parsed.mcpServers = {};
    return parsed;
  } catch {
    throw new Error(`.mcp.json exists but NEPTR could not parse it — fix or remove it, then try again.`);
  }
}

interface InstallOutcome {
  /** Keys added to .mcp.json. */
  added: string[];
  /** Names that had no derivable launch command. */
  skipped: McpCandidate[];
}

/** Merge selected servers into the project's `.mcp.json`, preserving existing entries. */
function installMcpServers(selected: McpCandidate[], cwd: string): InstallOutcome {
  const file = path.join(cwd, ".mcp.json");
  const config = readMcpJson(file);
  const servers = config.mcpServers as Record<string, McpServerConfig>;
  const taken = new Set(Object.keys(servers));
  const added: string[] = [];
  const skipped: McpCandidate[] = [];

  for (const candidate of selected) {
    if (!candidate.serverConfig) {
      skipped.push(candidate);
      continue;
    }
    const key = serverKey(candidate, taken);
    servers[key] = candidate.serverConfig;
    added.push(key);
  }

  if (added.length > 0) {
    config.mcpServers = servers;
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  }
  return { added, skipped };
}

/**
 * `neptr mcp <query>` — search skillful.sh for MCP servers, keep the ones whose
 * security grade clears the bar, and let the user pick any number to add to
 * this project's `.mcp.json` without leaving the editor.
 *
 * Two non-interactive modes mirror `neptr skill`:
 *   - `--search-only` lists the grade-passing candidates and exits.
 *   - `--yes` installs every shown candidate without prompting.
 */
export async function runMcp(query: string | undefined, flags: McpFlags): Promise<void> {
  const cwd = process.cwd();
  const limit = parseCount(flags.limit, DEFAULT_LIMIT);
  const minGrade = parseGrade(flags.minGrade);

  p.intro(pc.bgGreen(pc.black(" neptr mcp ")));

  let term = query?.trim();
  if (!term) {
    term = ensure(
      await p.text({
        message: "What kind of MCP server are you looking for?",
        placeholder: "postgres database",
        validate: (v) => ((v ?? "").trim().length >= 2 ? undefined : "Give me at least two characters to search for"),
      }),
    ).trim();
  }
  if (term.length < 2) throw new Error("Search term must be at least two characters");

  const spinner = p.spinner();
  spinner.start(`Searching skillful.sh for "${term}"`);
  let candidates: McpCandidate[];
  try {
    candidates = await gatherMcpCandidates(term, { limit, minGrade, fetchImpl: fetch });
  } catch (err) {
    spinner.stop(`${pc.red("✘")} search failed`);
    throw err;
  }
  spinner.stop(`${pc.green("✔")} found ${candidates.length} MCP server(s)`);

  if (candidates.length === 0) {
    neptr.warn(`No MCP servers matched "${term}". Try different words.`);
    p.outro("Nothing to install this time.");
    return;
  }

  const passing = candidates.filter((c) => c.verdict === "pass");
  const shown = flags.includeUnverified ? candidates : passing;

  if (flags.searchOnly) {
    reportSearchOnly(term, shown, candidates.length, Boolean(flags.includeUnverified));
    p.outro("Search only — nothing installed.");
    return;
  }

  if (shown.length === 0) {
    neptr.warn(
      `Found ${candidates.length} match(es), but none reached grade ${minGrade} or better yet. ` +
        `Re-run with --include-unverified (or a lower --min-grade) to see them.`,
    );
    p.outro("Pie tin stays empty — nothing installed.");
    return;
  }

  const installable = shown.filter((c) => c.serverConfig);
  if (installable.length === 0) {
    neptr.warn(
      `Found ${shown.length} matching server(s), but none are npm or PyPI packages NEPTR can auto-wire. ` +
        `Add them to .mcp.json by hand:`,
    );
    p.note(shown.map((c) => `${c.name} → ${c.repositoryUrl ?? "see its repo"}`).join("\n"), "Manual setup");
    p.outro("Nothing auto-installed this time.");
    return;
  }

  const selected: McpCandidate[] = flags.yes
    ? installable
    : ensure(
        await p.multiselect<McpCandidate>({
          message: `Select MCP servers to add to .mcp.json (${installable.length} installable, security-checked)`,
          required: false,
          options: installable.map((c) => ({
            value: c,
            label: c.name,
            hint: `${popularityHint(c)} · ${c.registry} · ${verdictBadge(c)}`,
          })),
        }),
      );

  if (selected.length === 0) {
    p.outro("No servers selected — maybe next time!");
    return;
  }

  if (!flags.yes) {
    const confirmMsg =
      selected.length === 1
        ? `Add ${pc.bold(selected[0]!.name)} to this project's .mcp.json?`
        : `Add these ${selected.length} MCP servers to this project's .mcp.json?`;
    const go = ensure(await p.confirm({ message: confirmMsg, initialValue: true }));
    if (!go) bail();
  }

  spinner.start(`Wiring up ${selected.length} MCP server(s)`);
  let outcome: InstallOutcome;
  try {
    outcome = installMcpServers(selected, cwd);
  } catch (err) {
    spinner.stop(`${pc.red("✘")} could not update .mcp.json`);
    throw err;
  }
  if (outcome.added.length > 0) {
    spinner.stop(`${pc.green("✔")} added ${outcome.added.length} server(s) to .mcp.json`);
  } else {
    spinner.stop(`${pc.yellow("⚠")} nothing added`);
  }

  if (outcome.added.length) {
    p.note(outcome.added.map((k) => `${pc.green("✔")} ${k}`).join("\n"), "Added to .mcp.json");
  }
  if (outcome.skipped.length) {
    p.note(
      outcome.skipped
        .map((c) => `${pc.yellow("⚠")} ${c.name} (${c.registry})\n   → configure by hand: ${c.repositoryUrl ?? "see its repo"}`)
        .join("\n"),
      "These need a hand",
    );
  }

  if (outcome.added.length) {
    neptr.success(`MCP servers deployed! ${pc.dim("Restart your agent so it picks up .mcp.json.")}`);
  } else {
    neptr.warn("No servers could be added automatically — see the manual steps above.");
  }
  p.outro("NEPTR wired up some new MCP servers!");
}
