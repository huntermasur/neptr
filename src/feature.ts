import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import { renderDir, renderFile } from "./template.js";
import { bmo } from "./theme.js";

export interface FeatureFlags {
  name?: string;
  yes?: boolean;
}

/** Kebab-case a feature name into a folder slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateFeatureName(name: string): string | undefined {
  if (!name.trim()) return "Feature name is required";
  if (name.length > 50) return "Keep it under 50 characters — it becomes a folder name";
  if (!slugify(name)) return "Name must contain at least one letter or number";
  return undefined;
}

/**
 * `beemo feature` — scaffold a plan → implement → review workspace at
 * .agents/features/<slug>/ in the current project, then print the copy-paste
 * prompts that hand each phase to an agent. Beemo never calls an LLM itself.
 */
export async function runFeature(description: string | undefined, flags: FeatureFlags): Promise<void> {
  const projectDir = process.cwd();
  const agentsDir = path.join(projectDir, ".agents");
  const featuresDir = path.join(agentsDir, "features");

  p.intro(pc.bgGreen(pc.black(" beemo feature ")));

  // This command runs inside an existing project; .agents/ is the marker that
  // it was scaffolded by Beemo. Offer to bootstrap just the features folder
  // elsewhere (--yes accepts the default and bootstraps silently).
  if (!fs.existsSync(agentsDir) && !flags.yes) {
    const go = ensure(
      await p.confirm({
        message: "No .agents/ hub here — this doesn't look like a Beemo project. Create just .agents/features/ and continue?",
        initialValue: true,
      }),
    );
    if (!go) bail();
  }

  let featureName = flags.name;
  if (featureName) {
    const err = validateFeatureName(featureName);
    if (err) throw new Error(err);
  } else {
    if (flags.yes) throw new Error("--yes needs --name <name> so BMO knows what to call the feature");
    featureName = ensure(
      await p.text({
        message: "Short feature name? (becomes the folder name)",
        placeholder: "dark-mode-toggle",
        validate: (v) => validateFeatureName(v ?? ""),
      }),
    );
  }
  const slug = slugify(featureName);

  let desc = description;
  if (!desc) {
    if (flags.yes) {
      desc = "(not provided — planning agent: ask the user what this feature should do before writing the plan)";
    } else {
      desc = ensure(
        await p.text({
          message: "Describe the feature — what should it do, for whom?",
          placeholder: "Users can toggle dark mode from the header, persisted across visits",
          validate: (v) => ((v ?? "").trim() ? undefined : "The planning agent needs at least a sentence to work with"),
        }),
      );
    }
  }

  const featureDir = path.join(featuresDir, slug);
  const featurePath = `.agents/features/${slug}`;
  if (fs.existsSync(featureDir)) {
    p.log.error(`${featurePath} already exists. Beemo does not overwrite friends — pick another name.`);
    process.exit(1);
  }

  if (!flags.yes) {
    const summary = [
      `${pc.dim("feature")}   ${featureName}`,
      `${pc.dim("folder")}    ${featurePath}/`,
      `${pc.dim("describe")}  ${desc}`,
    ].join("\n");
    p.note(summary, "Here is the plan!");
    const go = ensure(await p.confirm({ message: "Create the feature workspace?", initialValue: true }));
    if (!go) bail();
  }

  // The shared features README is var-free, so it renders fine even in
  // projects Beemo never scaffolded.
  const featuresReadme = path.join(featuresDir, "README.md");
  if (!fs.existsSync(featuresReadme)) {
    renderFile(".agents/features/README.md", featuresReadme, {});
  }
  renderDir("feature", featureDir, {
    featureName,
    description: desc,
    date: new Date().toISOString().slice(0, 10),
    featurePath,
  });

  p.log.success(`Feature workspace created at ${featurePath}/`);
  p.outro("BMO made a new game cartridge!");

  // Plain console.log for the prompts themselves: clack's gutter characters
  // would be captured when the user copies the line.
  console.log(pc.bold("Next: run each phase with an agent — copy, paste, play.\n"));
  console.log(pc.green(pc.bold("1. Plan")) + pc.dim("  — use your smartest model"));
  console.log(
    `Read ${featurePath}/phases/plan.md and follow it exactly: research this codebase and fill in ${featurePath}/PLAN.md and ${featurePath}/TASKS.md for the feature described there. Do not write code.\n`,
  );
  console.log(pc.green(pc.bold("2. Implement")) + pc.dim("  — a cheaper model is fine"));
  console.log(
    `Read ${featurePath}/phases/implement.md and follow it exactly: implement the feature per ${featurePath}/PLAN.md, checking off TASKS.md and updating NOTES.md and STATUS.md as you go.\n`,
  );
  console.log(pc.green(pc.bold("3. Review")) + pc.dim("  — back to the smart model"));
  console.log(
    `Read ${featurePath}/phases/review.md and follow it exactly: verify the implementation in this repo against ${featurePath}/PLAN.md, fix what's broken, and set the status to done.\n`,
  );
  bmo.say("Paste each prompt into a fresh agent session, and wait for the pause between phases!");
}
