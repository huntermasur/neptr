import path from "node:path";
import fs from "node:fs";
import { renderDir } from "../template.js";
import type { NEPTRConfig } from "../config.js";

/**
 * Lay the canonical section folders (from `templates/src-layout/`) into the
 * Vite-scaffolded `src/`, plus a root-level `tests/` folder. Each section ships a
 * README that documents its purpose and doubles as a git-tracked placeholder.
 * Additive: it leaves the template's own files (main, App, styles) in place and
 * only adds the sections that don't already exist.
 */
export async function srcLayoutStep(config: NEPTRConfig): Promise<void> {
  const srcDir = path.join(config.targetDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  renderDir("src-layout", srcDir, {});
  renderDir("tests", path.join(config.targetDir, "tests"), {});
}
