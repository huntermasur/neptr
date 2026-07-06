import { execa, type Options } from "execa";

/**
 * Run an external command. On Windows, npm/npx/git-adjacent tools ship as .cmd
 * shims which Node can only spawn through a shell, so we always go through one
 * there. With shell:true execa joins args with spaces and does not quote them,
 * so every arg MUST already be shell-safe: callers validate anything dynamic
 * against a strict allowlist (see `isSafeInstallArg`, `validateProjectName`)
 * before it reaches here — run() itself does no quoting.
 */
export async function run(command: string, args: string[], options: Options = {}) {
  const useShell = process.platform === "win32";
  return execa(command, args, {
    windowsHide: true,
    ...options,
    ...(useShell ? { shell: true } : {}),
  });
}

/** True when `command --version` (or a custom probe) exits 0. */
export async function commandExists(command: string, probeArgs: string[] = ["--version"]): Promise<boolean> {
  try {
    await run(command, probeArgs, { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

/** Result of one scaffold step, collected for the end-of-run summary. */
export interface StepResult {
  name: string;
  status: "ok" | "skipped" | "failed";
  note?: string;
  /** Manual command the user can run to do the step themselves. */
  fix?: string;
}
