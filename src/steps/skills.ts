import { run } from "../run.js";
import type { BeemoConfig } from "../config.js";

/**
 * Install each selected skills.sh skill via `npx skills add`. Failures are
 * collected per skill so one bad repo doesn't block the rest. Only runs when at
 * least one skill is selected (gated by `enabled` in cli.ts).
 */
export async function skillsStep(config: BeemoConfig): Promise<string> {
  const failed: string[] = [];
  for (const skill of config.skills) {
    try {
      // --agent universal installs into the canonical .agents/skills/ only,
      // instead of creating a directory per known agent.
      await run("npx", ["-y", "skills", "add", skill, "--agent", "universal", "-y"], {
        cwd: config.targetDir,
        stdio: "pipe",
        timeout: 180_000,
      });
    } catch {
      failed.push(skill);
    }
  }
  if (failed.length === config.skills.length) {
    throw new Error(`every skill failed to install (${failed.join(", ")})`);
  }
  if (failed.length) {
    return `installed ${config.skills.length - failed.length}/${config.skills.length}; failed: ${failed.join(", ")} (retry: npx skills add <repo[@skill]> --agent universal)`;
  }
  return `installed ${config.skills.length} skill(s)`;
}
