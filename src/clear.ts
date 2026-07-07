import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";

/** Log-row marker written by `templates/feature/STATUS.md`. */
export const FEATURE_WORKSPACE_MARKER = "Workspace scaffolded by `neptr feature`";

export interface ClearFlags {
  yes?: boolean;
}

/** True when `dir` looks like a workspace created by `neptr feature`. */
export function isFeatureWorkspace(dir: string): boolean {
  const statusFile = path.join(dir, "STATUS.md");
  if (!fs.existsSync(statusFile)) return false;
  try {
    return fs.readFileSync(statusFile, "utf8").includes(FEATURE_WORKSPACE_MARKER);
  } catch {
    return false;
  }
}

/** Slugs under `.docs/feature/` that were scaffolded by `neptr feature`. */
export function listFeatureWorkspaces(featuresDir: string): string[] {
  if (!fs.existsSync(featuresDir)) return [];
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => isFeatureWorkspace(path.join(featuresDir, slug)));
}

/**
 * `neptr clear` — remove feature workspaces under `.docs/feature/` that were
 * created by `neptr feature`. Adoption workspaces (`neptr adopt`) are left alone.
 */
export async function runClear(flags: ClearFlags): Promise<void> {
  const projectDir = process.cwd();
  const featuresDir = path.join(projectDir, ".docs", "feature");
  const slugs = listFeatureWorkspaces(featuresDir);

  p.intro(pc.bgGreen(pc.black(" neptr clear ")));

  if (slugs.length === 0) {
    p.log.info("No `neptr feature` workspaces found — nothing to clear.");
    p.outro("NEPTR's feature shelf is already spotless!");
    return;
  }

  const paths = slugs.map((slug) => `.docs/feature/${slug}/`);
  if (!flags.yes) {
    p.note(paths.map((fp) => `  ${fp}`).join("\n"), `${slugs.length} feature workspace(s) to remove`);
    const go = ensure(
      await p.confirm({
        message: "Delete these feature workspaces? This cannot be undone.",
        initialValue: false,
      }),
    );
    if (!go) bail();
  }

  for (const slug of slugs) {
    fs.rmSync(path.join(featuresDir, slug), { recursive: true, force: true });
  }

  p.log.success(`Removed ${slugs.length} feature workspace(s).`);
  p.outro("NEPTR cleared the feature shelf — fresh space for the next pie!");
}
