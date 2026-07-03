import * as p from "@clack/prompts";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import { run } from "./run.js";
import { bmo } from "./theme.js";
import { gatherCandidates, type SkillCandidate, type SecurityVerdict } from "./skills-registry.js";

export interface SkillFlags {
  minInstalls?: string;
  limit?: string;
  includeUnverified?: boolean;
}

const DEFAULT_MIN_INSTALLS = 1000;
const DEFAULT_LIMIT = 20;

/** Parse a positive-integer flag, falling back to `fallback` when absent/invalid. */
function parseCount(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected a non-negative number, got "${raw}"`);
  return n;
}

/** Render an install count as e.g. 435.6k / 2.3M for compact hints. */
export function formatInstalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function verdictBadge(verdict: SecurityVerdict): string {
  switch (verdict) {
    case "pass":
      return pc.green("✓ audits pass");
    case "warn":
      return pc.yellow("⚠ audit warnings");
    case "fail":
      return pc.red("✘ audit failed");
    case "unaudited":
      return pc.dim("• not audited yet");
  }
}

/** Install each selected skill into the current project via `npx skills add`. */
async function installSkills(sources: string[], cwd: string): Promise<{ ok: string[]; failed: string[] }> {
  const ok: string[] = [];
  const failed: string[] = [];
  for (const source of sources) {
    try {
      await run("npx", ["-y", "skills", "add", source, "--agent", "universal", "-y"], {
        cwd,
        stdio: "pipe",
        timeout: 180_000,
      });
      ok.push(source);
    } catch {
      failed.push(source);
    }
  }
  return { ok, failed };
}

/**
 * `beemo skill <query>` — search skills.sh, keep only well-downloaded skills
 * whose security audits all pass, and let the user pick any number to install
 * into the current project's .agents/skills/ without leaving the editor.
 */
export async function runSkill(query: string | undefined, flags: SkillFlags): Promise<void> {
  const cwd = process.cwd();
  const minInstalls = parseCount(flags.minInstalls, DEFAULT_MIN_INSTALLS);
  const limit = parseCount(flags.limit, DEFAULT_LIMIT);

  p.intro(pc.bgGreen(pc.black(" beemo skill ")));

  let term = query?.trim();
  if (!term) {
    term = ensure(
      await p.text({
        message: "What kind of skill are you looking for?",
        placeholder: "web design",
        validate: (v) => ((v ?? "").trim().length >= 2 ? undefined : "Give me at least two characters to search for"),
      }),
    ).trim();
  }
  if (term.length < 2) throw new Error("Search term must be at least two characters");

  const spinner = p.spinner();
  spinner.start(`Searching skills.sh for "${term}"`);
  let candidates: SkillCandidate[];
  try {
    candidates = await gatherCandidates(term, { minInstalls, limit });
  } catch (err) {
    spinner.stop(`${pc.red("✘")} search failed`);
    throw err;
  }
  spinner.stop(`${pc.green("✔")} found ${candidates.length} skill(s) with 1000+ installs`);

  if (candidates.length === 0) {
    bmo.warn(`No popular skills matched "${term}". Try different words or lower the bar with --min-installs 0.`);
    p.outro("Nothing to install this time.");
    return;
  }

  const verified = candidates.filter((c) => c.verdict === "pass");
  const shown = flags.includeUnverified ? candidates : verified;

  if (shown.length === 0) {
    bmo.warn(
      `Found ${candidates.length} match(es), but none have passed every security audit yet. ` +
        `Re-run with --include-unverified to see them (and their audit status).`,
    );
    p.outro("Playing it safe — nothing installed.");
    return;
  }

  const selected = ensure(
    await p.multiselect<string>({
      message: `Select skills to install (${shown.length} shown, security-checked)`,
      required: false,
      options: shown.map((c) => ({
        value: c.installArg,
        label: c.name,
        hint: `${formatInstalls(c.installs)} installs · ${c.source} · ${verdictBadge(c.verdict)}`,
      })),
    }),
  );

  if (selected.length === 0) {
    p.outro("No skills selected — maybe next time!");
    return;
  }

  const confirmMsg =
    selected.length === 1
      ? `Install ${pc.bold(selected[0]!)} into this project?`
      : `Install these ${selected.length} skills into this project?`;
  const go = ensure(await p.confirm({ message: confirmMsg, initialValue: true }));
  if (!go) bail();

  spinner.start(`Installing ${selected.length} skill(s)`);
  const { ok, failed } = await installSkills(selected, cwd);
  if (failed.length === 0) {
    spinner.stop(`${pc.green("✔")} installed ${ok.length} skill(s)`);
  } else if (ok.length === 0) {
    spinner.stop(`${pc.red("✘")} could not install any skills`);
  } else {
    spinner.stop(`${pc.yellow("⚠")} installed ${ok.length}/${selected.length} skill(s)`);
  }

  if (ok.length) {
    p.note(ok.map((s) => `${pc.green("✔")} ${s}`).join("\n"), "Added to .agents/skills/");
  }
  if (failed.length) {
    p.note(
      failed.map((s) => `${pc.red("✘")} ${s}\n   → retry: npx skills add ${s} --agent universal`).join("\n"),
      "These need a hand",
    );
  }

  if (ok.length) {
    bmo.success(`New skills installed! ${pc.dim("Restart your agent so it picks them up.")}`);
  } else {
    bmo.warn("None of the skills installed — check the retry commands above.");
  }
  p.outro("BMO went shopping for skills!");
}
