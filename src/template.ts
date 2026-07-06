import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Root of the templates/ directory (ships alongside dist/ in the package). */
export const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates");

export type TemplateVars = Record<string, string>;

/**
 * Replace every {{key}} with vars[key]; unknown keys are left intact so they're easy
 * to spot. A line whose placeholders all rendered empty (e.g. an optional table row)
 * is dropped entirely so it doesn't leave a stray blank line.
 */
export function renderString(content: string, vars: TemplateVars): string {
  const out: string[] = [];
  for (const line of content.split("\n")) {
    const hadPlaceholder = /\{\{\w+\}\}/.test(line);
    const rendered = line.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
    if (hadPlaceholder && rendered.trim() === "") continue;
    out.push(rendered);
  }
  return out.join("\n");
}

export interface RenderOptions {
  /**
   * When false, a destination file that already exists is left untouched (and its
   * path is passed to `onSkip`). Defaults to true. Used by `neptr adopt` to
   * retrofit scaffolding into an existing project without clobbering its files.
   */
  overwrite?: boolean;
  /** Called with the project-relative-ish destPath each time a file is skipped. */
  onSkip?: (destPath: string) => void;
}

/** Render a single template file to a destination path, creating parent dirs. */
export function renderFile(
  templateRelPath: string,
  destPath: string,
  vars: TemplateVars,
  opts: RenderOptions = {},
): void {
  if (opts.overwrite === false && fs.existsSync(destPath)) {
    opts.onSkip?.(destPath);
    return;
  }
  const src = path.join(TEMPLATES_DIR, templateRelPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, renderString(fs.readFileSync(src, "utf8"), vars));
}

/** Recursively render every file in a template directory into destDir. */
export function renderDir(
  templateRelDir: string,
  destDir: string,
  vars: TemplateVars,
  opts: RenderOptions = {},
): void {
  const srcDir = path.join(TEMPLATES_DIR, templateRelDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      renderDir(path.join(templateRelDir, entry.name), destPath, vars, opts);
    } else {
      renderFile(path.join(templateRelDir, entry.name), destPath, vars, opts);
    }
  }
}
