import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import { MCP_CONFIG_FILES } from "./config.js";
import { neptr } from "./theme.js";
import {
  gatherMcpCandidates,
  type Check,
  type McpCandidate,
  type McpServerConfig,
  type Verdict,
} from "./mcp-registry.js";

export interface McpFlags {
  limit?: string;
  /** Also show servers with a "caution" (or unrunnable) verdict, not just "safe". */
  includeUnverified?: boolean;
  /** List matching, verified servers without prompting or installing. */
  searchOnly?: boolean;
  /** Install every shown (safe) server without prompting. */
  yes?: boolean;
}

const DEFAULT_LIMIT = 12;

/** Human-readable list of the config files servers get written to. */
const MCP_FILES_LABEL = MCP_CONFIG_FILES.join(" + ");

/** Parse a positive-integer flag, falling back to `fallback` when absent/invalid. */
function parseCount(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected a non-negative number, got "${raw}"`);
  return n;
}

/** Colored badge for a server's overall verdict. */
function verdictBadge(verdict: Verdict): string {
  switch (verdict) {
    case "safe":
      return pc.green("✓ safe");
    case "caution":
      return pc.yellow("⚠ caution");
    case "avoid":
      return pc.red("✘ avoid");
  }
}

/** Symbol for a single check's status. */
function checkMark(status: Check["status"]): string {
  switch (status) {
    case "ok":
      return pc.green("✓");
    case "warn":
      return pc.yellow("⚠");
    case "unknown":
      return pc.dim("•");
  }
}

/** One-line reason summarizing the most useful checks next to a server. */
function reasonHint(c: McpCandidate): string {
  const by = (id: Check["id"]) => c.verification.checks.find((k) => k.id === id);
  const bits = [by("vendor")?.detail, by("runnable")?.detail].filter(Boolean);
  const concern = c.verification.checks.find((k) => k.status === "warn" && (k.id === "access" || k.id === "activity"));
  if (concern) bits.push(concern.detail);
  return bits.join(" · ");
}

/** The full per-server checklist, one line per criterion. */
function checklistBlock(c: McpCandidate): string {
  return c.verification.checks.map((k) => `  ${checkMark(k.status)} ${k.label}: ${k.detail}`).join("\n");
}

/**
 * Print the candidate servers without prompting or installing. Mirrors the
 * `neptr skill --search-only` planning mode so an agent can record servers,
 * their verdicts, and the exact install command.
 */
function reportSearchOnly(term: string, shown: McpCandidate[], total: number): void {
  if (shown.length === 0) {
    neptr.warn(
      `Found ${total} MCP server(s) for "${term}", but none cleared the safety bar. ` +
        `Re-run with --include-unverified to list them with their checklist.`,
    );
    return;
  }
  console.log(pc.bold(`\nMCP servers matching "${term}":\n`));
  for (const c of shown) {
    console.log(`${verdictBadge(c.verification.verdict)}  ${pc.bold(c.name)}  ${pc.dim(reasonHint(c))}`);
    console.log(checklistBlock(c));
    if (c.serverConfig) {
      // The server's own name, not the search term — a broad term re-run with
      // --yes would install every safe match, not just this one.
      console.log(`  install: ${pc.green(`neptr mcp "${c.name}" --yes`)}`);
    } else {
      console.log(`  ${pc.dim(`no auto-install — see ${c.repositoryUrl ?? "its repo"}`)}`);
    }
    console.log("");
  }
}

/** A sanitized, collision-free key for the `.mcp.json` mcpServers map. */
function serverKey(candidate: McpCandidate, taken: Set<string>): string {
  // Prefer the trailing name segment of the reverse-DNS namespace.
  const raw = candidate.name.includes("/") ? candidate.name.slice(candidate.name.lastIndexOf("/") + 1) : candidate.name;
  const base = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "mcp-server";
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

/** Read an MCP config file, tolerating a missing or malformed file. */
function readMcpJson(file: string): McpJson {
  if (!fs.existsSync(file)) return { mcpServers: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as McpJson;
    if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") parsed.mcpServers = {};
    return parsed;
  } catch {
    const name = path.basename(path.dirname(file)) === ".cursor" ? ".cursor/mcp.json" : path.basename(file);
    throw new Error(`${name} exists but NEPTR could not parse it — fix or remove it, then try again.`);
  }
}

interface InstallOutcome {
  /** Keys added to .mcp.json. */
  added: string[];
  /** Candidates that had no derivable launch command. */
  skipped: McpCandidate[];
  /** Keys whose server declares (likely secret) env vars to fill in by hand. */
  needSecret: string[];
}

/** Merge the given server entries into one MCP config file, preserving existing entries. */
function mergeIntoFile(file: string, entries: Record<string, McpServerConfig>): void {
  const config = readMcpJson(file);
  Object.assign(config.mcpServers as Record<string, McpServerConfig>, entries);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Merge selected servers into every MCP config file (`.mcp.json` for Claude and
 * `.cursor/mcp.json` for Cursor), preserving existing entries. Keys are derived
 * once against `.mcp.json` so the same server lands under the same key in both.
 */
function installMcpServers(selected: McpCandidate[], cwd: string): InstallOutcome {
  const rootConfig = readMcpJson(path.join(cwd, ".mcp.json"));
  const taken = new Set(Object.keys(rootConfig.mcpServers as Record<string, McpServerConfig>));
  const entries: Record<string, McpServerConfig> = {};
  const added: string[] = [];
  const skipped: McpCandidate[] = [];
  const needSecret: string[] = [];

  for (const candidate of selected) {
    if (!candidate.serverConfig) {
      skipped.push(candidate);
      continue;
    }
    const key = serverKey(candidate, taken);
    entries[key] = candidate.serverConfig;
    added.push(key);
    if (candidate.verification.needsSecret) needSecret.push(key);
  }

  if (added.length > 0) {
    for (const rel of MCP_CONFIG_FILES) mergeIntoFile(path.join(cwd, rel), entries);
  }
  return { added, skipped, needSecret };
}

/**
 * `neptr mcp <query>` — search the official MCP registry for servers, run a
 * transparent safety check on each (vendor, activity, access surface, local/
 * Docker runnability, version pinning), and let the user add any of the safe
 * ones to this project's `.mcp.json` (version-pinned) without leaving the editor.
 *
 * Two non-interactive modes mirror `neptr skill`:
 *   - `--search-only` lists the verified candidates + checklists and exits.
 *   - `--yes` installs every shown safe candidate without prompting.
 */
export async function runMcp(query: string | undefined, flags: McpFlags): Promise<void> {
  const cwd = process.cwd();
  const limit = parseCount(flags.limit, DEFAULT_LIMIT);
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined;

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
  spinner.start(`Searching the MCP registry for "${term}"`);
  let candidates: McpCandidate[];
  try {
    candidates = await gatherMcpCandidates(term, { limit, fetchImpl: fetch, githubToken });
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

  // Default view: only "safe" servers. --include-unverified also shows
  // "caution"/"avoid", ordered best-first so the safe ones stay on top.
  const VERDICT_ORDER: Record<Verdict, number> = { safe: 0, caution: 1, avoid: 2 };
  const shown = flags.includeUnverified
    ? [...candidates].sort((a, b) => VERDICT_ORDER[a.verification.verdict] - VERDICT_ORDER[b.verification.verdict])
    : candidates.filter((c) => c.verification.verdict === "safe");

  if (flags.searchOnly) {
    reportSearchOnly(term, shown, candidates.length);
    p.outro("Search only — nothing installed.");
    return;
  }

  if (shown.length === 0) {
    neptr.warn(
      `Found ${candidates.length} match(es), but none cleared the safety bar. ` +
        `Re-run with --include-unverified to see them and their checklists.`,
    );
    p.outro("Pie tin stays empty — nothing installed.");
    return;
  }

  const installable = shown.filter((c) => c.serverConfig);
  if (installable.length === 0) {
    neptr.warn(
      `Found ${shown.length} matching server(s), but none have a launch command NEPTR can auto-wire. ` +
        `Add them to .mcp.json by hand:`,
    );
    p.note(shown.map((c) => `${c.name} → ${c.repositoryUrl ?? "see its repo"}`).join("\n"), "Manual setup");
    p.outro("Nothing auto-installed this time.");
    return;
  }

  const selected: McpCandidate[] = flags.yes
    ? installable.filter((c) => c.verification.verdict === "safe")
    : ensure(
        await p.multiselect<McpCandidate>({
          message: `Select MCP servers to add to ${MCP_FILES_LABEL} (${installable.length} installable, safety-checked)`,
          required: false,
          options: installable.map((c) => ({
            value: c,
            label: c.name,
            hint: `${verdictBadge(c.verification.verdict)} · ${reasonHint(c)}`,
          })),
        }),
      );

  if (selected.length === 0) {
    p.outro(flags.yes ? "No safe servers to add — maybe next time!" : "No servers selected — maybe next time!");
    return;
  }

  if (!flags.yes) {
    const confirmMsg =
      selected.length === 1
        ? `Add ${pc.bold(selected[0]!.name)} to this project's ${MCP_FILES_LABEL}?`
        : `Add these ${selected.length} MCP servers to this project's ${MCP_FILES_LABEL}?`;
    const go = ensure(await p.confirm({ message: confirmMsg, initialValue: true }));
    if (!go) bail();
  }

  spinner.start(`Wiring up ${selected.length} MCP server(s)`);
  let outcome: InstallOutcome;
  try {
    outcome = installMcpServers(selected, cwd);
  } catch (err) {
    spinner.stop(`${pc.red("✘")} could not update ${MCP_FILES_LABEL}`);
    throw err;
  }
  if (outcome.added.length > 0) {
    spinner.stop(`${pc.green("✔")} added ${outcome.added.length} server(s) to ${MCP_FILES_LABEL}`);
  } else {
    spinner.stop(`${pc.yellow("⚠")} nothing added`);
  }

  if (outcome.added.length) {
    p.note(outcome.added.map((k) => `${pc.green("✔")} ${k}`).join("\n"), `Added to ${MCP_FILES_LABEL} (version-pinned)`);
  }
  if (outcome.needSecret.length) {
    p.note(
      outcome.needSecret.map((k) => `${pc.yellow("⚠")} ${k} — declares environment variables; fill in credentials by hand`).join("\n"),
      "These need a secret",
    );
  }
  if (outcome.skipped.length) {
    p.note(
      outcome.skipped
        .map((c) => `${pc.yellow("⚠")} ${c.name}\n   → configure by hand: ${c.repositoryUrl ?? "see its repo"}`)
        .join("\n"),
      "These need a hand",
    );
  }

  if (outcome.added.length) {
    neptr.success(`MCP servers deployed! ${pc.dim(`Restart your agent so it picks up ${MCP_FILES_LABEL}.`)}`);
  } else {
    neptr.warn("No servers could be added automatically — see the manual steps above.");
  }
  p.outro("NEPTR wired up some new MCP servers!");
}
