import { execa, type Options } from "execa";

/**
 * Wrap whitespace-bearing args in double quotes for Windows shell:true, where
 * execa joins args with spaces and does not quote them. Only fixed literals
 * carry whitespace (e.g. the initial-commit message); anything dynamic is
 * allowlist-validated upstream (see `isSafeInstallArg`, `validateProjectName`)
 * and never contains whitespace, quotes, or shell metacharacters — args with
 * embedded quotes are not supported (cmd.exe has no sane escape for them).
 */
export function shellQuote(args: string[]): string[] {
  return args.map((a) => (/\s/.test(a) ? `"${a}"` : a));
}

/**
 * Run an external command. On Windows, npm/npx/git-adjacent tools ship as .cmd
 * shims which Node can only spawn through a shell, so we always go through one
 * there (see `shellQuote` for the arg rules that makes this safe).
 */
export async function run(command: string, args: string[], options: Options = {}) {
  const useShell = process.platform === "win32";
  return execa(command, useShell ? shellQuote(args) : args, {
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
