import path from "node:path";
import fs from "node:fs";
import { commandExists, run } from "../run.js";
import type { NEPTRConfig } from "../config.js";

const EXTRA_IGNORES = `
# NEPTR additions
.env
.env.*
!.env.example
`;

/**
 * Runs last: augments .gitignore, initializes the repo, and commits everything
 * the scaffold produced as the initial commit.
 */
export async function gitStep(config: NEPTRConfig): Promise<void> {
  // `git commit` fails cryptically without an identity — check up front so the
  // summary note tells the user exactly what to do.
  if (!(await commandExists("git", ["config", "user.email"]))) {
    throw new Error(
      'git identity not set — run: git config --global user.name "Your Name" && git config --global user.email you@example.com',
    );
  }

  const gitignorePath = path.join(config.targetDir, ".gitignore");
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
  if (!existing.includes("# NEPTR additions")) {
    const base = existing.trimEnd();
    fs.writeFileSync(gitignorePath, (base ? base + "\n\n" : "") + EXTRA_IGNORES.trimStart());
  }

  const opts = { cwd: config.targetDir, stdio: "pipe" as const, timeout: 60_000 };
  await run("git", ["init", "-b", "main"], opts);
  await run("git", ["add", "-A"], opts);
  await run("git", ["commit", "-m", "Initial commit from NEPTR"], opts);

  // Activate the shared pre-commit hook (added by the indexing step) *after* the
  // initial commit, so the first commit stays fast and can't be blocked by it.
  if (fs.existsSync(path.join(config.targetDir, ".githooks"))) {
    await run("git", ["config", "core.hooksPath", ".githooks"], opts);
  }
}
