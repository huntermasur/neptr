import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import { renderDir, renderFile } from "./template.js";
import { templateVars } from "./steps/ai-docs.js";
import { writeAgentInstructions } from "./steps/agents.js";
import { installIndexing } from "./indexer.js";
import { neptr } from "./theme.js";
import {
  AGENT_IDS,
  DEFAULTS,
  VITE_TEMPLATES,
  type NEPTRConfig,
  type ViteTemplate,
} from "./config.js";
import { slugify } from "./feature.js";
import {
  buildDockerInventory,
  buildDocsInventory,
  buildEnvInventory,
  buildInventory,
  buildTestsInventory,
  detectDocker,
  detectWorkspaces,
} from "./adopt-scan.js";
import { writeDockerDrafts, type DockerDraftResult } from "./adopt-docker.js";

export interface AdoptFlags {
  /** Slug for the migration workspace folder (default: adopt-neptr-layout). */
  name?: string;
  /** Comma-separated agent instruction files to generate (or 'none'). */
  agents?: string;
  /** `--no-index` sets this false: skip the code-indexing hooks + REPO_MAP. */
  index?: boolean;
  /** `--no-plan` sets this false: skip the agent migration workspace. */
  plan?: boolean;
  /** `--no-docs` sets this false: skip the documentation inventory + workstream. */
  docs?: boolean;
  /** `--no-tests` sets this false: skip the test inventory + workstream. */
  tests?: boolean;
  /** `--no-docker` sets this false: skip server/db detection, drafts, and the workstream. */
  docker?: boolean;
  /** No prompts — retrofit and scaffold with defaults. */
  yes?: boolean;
}

/** Read the project's package.json, tolerating its absence. */
function readPackageJson(root: string): Record<string, unknown> {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Guess the Vite-template label for the docs from the project's dependencies. */
export function inferTemplate(root: string, pkg: Record<string, unknown>): ViteTemplate {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  const has = (name: string): boolean => name in deps;
  const isTs = has("typescript") || fs.existsSync(path.join(root, "tsconfig.json"));
  const suffix = isTs ? "-ts" : "";

  let base = "vanilla";
  if (has("react")) base = "react";
  else if (has("vue")) base = "vue";
  else if (has("svelte")) base = "svelte";
  else if (has("solid-js")) base = "solid";
  else if (has("preact")) base = "preact";
  else if (has("lit")) base = "lit";
  else if (has("@builder.io/qwik")) base = "qwik";

  const candidate = `${base}${suffix}`;
  return (VITE_TEMPLATES as readonly string[]).includes(candidate)
    ? (candidate as ViteTemplate)
    : "vanilla-ts";
}

/** A NEPTRConfig good enough to render the .agents/.docs templates for an existing project. */
export function inferConfig(root: string, agents: string[]): NEPTRConfig {
  const pkg = readPackageJson(root);
  const rawName = typeof pkg.name === "string" && pkg.name.trim() ? pkg.name : path.basename(root);
  return {
    projectName: rawName,
    targetDir: root,
    template: inferTemplate(root, pkg),
    mcpServers: [],
    skills: [],
    agents,
    docker: false,
    git: fs.existsSync(path.join(root, ".git")),
    installDeps: false,
    yes: true,
  };
}

/** Placeholder rendered under a NOTES.md heading when a workstream is skipped. */
function skipNote(flag: string): string {
  return `_Workstream skipped via ${flag} — re-run \`neptr adopt\` without the flag to inventory it._`;
}

/** Pull the "Found N …" count out of an inventory for the confirm summary. */
function inventoryCount(inventory: string): string {
  return /^Found (\d+)/.exec(inventory)?.[1] ?? "0";
}

/**
 * `neptr adopt` — retrofit NEPTR's additive scaffolding into the current project,
 * then scaffold an agent-driven migration workspace that plans and executes the
 * risky part: moving code, tests and docs into the role-based layout and standing
 * up a verified Docker setup. NEPTR never calls an LLM; the only files it writes
 * beyond the additive scaffolding are DRAFT Docker files the agent must finish.
 */
export async function runAdopt(flags: AdoptFlags): Promise<void> {
  const root = process.cwd();
  p.intro(pc.bgGreen(pc.black(" neptr adopt ")));

  const pkg = readPackageJson(root);
  if (!pkg.name && !fs.existsSync(path.join(root, "package.json"))) {
    if (!flags.yes) {
      const go = ensure(
        await p.confirm({
          message: "No package.json here — this may not be a JS/TS project. Adopt it anyway?",
          initialValue: false,
        }),
      );
      if (!go) bail();
    }
  }

  // Agent selection: flag wins, else default set.
  let agents = DEFAULTS.agents;
  if (flags.agents !== undefined) {
    if (flags.agents === "none" || flags.agents.trim() === "") {
      agents = [];
    } else {
      agents = flags.agents.split(",").map((s) => s.trim()).filter(Boolean);
      for (const id of agents) {
        if (!AGENT_IDS.includes(id)) {
          throw new Error(`Unknown agent "${id}". Valid options: ${AGENT_IDS.join(", ")}`);
        }
      }
    }
  }

  const config = inferConfig(root, agents);
  const slug = slugify(flags.name || "adopt-neptr-layout");
  const featurePath = `.docs/feature/${slug}`;
  const featureDir = path.join(root, ".docs", "feature", slug);

  // Up-front scans (all read-only) so the confirm summary can show what each
  // workstream found; the results feed NOTES.md and the Docker drafts.
  const monorepo = detectWorkspaces(root, pkg);
  if (monorepo) {
    neptr.warn(`Workspace/monorepo markers found (${monorepo}) — NEPTR's layout applies per package; adopt scans the repo root only.`);
  }
  const docsInventory = flags.docs === false ? skipNote("--no-docs") : buildDocsInventory(root);
  const testsInventory = flags.tests === false ? skipNote("--no-tests") : buildTestsInventory(root, pkg);
  const dockerScan = flags.docker === false ? undefined : detectDocker(root, pkg);

  let dockerSummary = "skipped (--no-docker)";
  if (dockerScan) {
    const detected = dockerScan.services.map((s) => s.label).join(" + ");
    if (dockerScan.existingFiles.length) {
      dockerSummary = `existing ${dockerScan.existingFiles.join(", ")} found — inventory only, no drafts`;
    } else if (dockerScan.hasServer || dockerScan.hasDb) {
      dockerSummary = `detected ${detected} → draft Dockerfile + docker-compose.yml`;
    } else if (dockerScan.hasVite) {
      dockerSummary = "Vite app, no server/db → draft nginx-based Docker setup";
    } else {
      dockerSummary = "no server, database, or Vite app detected — nothing to draft";
    }
  }

  if (!flags.yes) {
    const summary = [
      `${pc.dim("project")}   ${config.projectName}`,
      `${pc.dim("stack")}     ${config.template} (inferred)`,
      `${pc.dim("agents")}    ${agents.length ? agents.join(", ") : "none"}`,
      `${pc.dim("retrofit")}  .agents/, .docs/, agent files, src/ sections${flags.index === false ? "" : ", code index"} (additive — never overwrites)`,
      `${pc.dim("docs")}      ${flags.docs === false ? "skipped (--no-docs)" : `${inventoryCount(docsInventory)} file(s) to relocate (inventory only)`}`,
      `${pc.dim("tests")}     ${flags.tests === false ? "skipped (--no-tests)" : `${inventoryCount(testsInventory)} file(s) (inventory only)`}`,
      `${pc.dim("docker")}    ${dockerSummary}`,
      `${pc.dim("plan")}      ${flags.plan === false ? "skipped" : `${featurePath}/ (agent migration workspace)`}`,
    ].join("\n");
    p.note(summary, "Here is how NEPTR will adopt this project");
    const go = ensure(await p.confirm({ message: "Proceed?", initialValue: true }));
    if (!go) bail();
  }

  // --- Part A: additive retrofit (non-destructive) --------------------------
  const vars = templateVars(config);
  const skipped: string[] = [];
  const onSkip = (dest: string): void => {
    skipped.push(path.relative(root, dest).split(path.sep).join("/"));
  };
  const created: string[] = [];

  const spin = p.spinner();
  spin.start("Retrofitting NEPTR scaffolding");
  try {
    renderDir(".agents", path.join(root, ".agents"), vars, { overwrite: false, onSkip });
    renderDir(".docs", path.join(root, ".docs"), vars, { overwrite: false, onSkip });
    renderFile("project/README.md", path.join(root, "README.md"), vars, { overwrite: false, onSkip });
    created.push(".agents/", ".docs/");

    renderDir("src-layout", path.join(root, "src"), {}, { overwrite: false, onSkip });
    renderDir("tests", path.join(root, "tests"), {}, { overwrite: false, onSkip });
    created.push("src/{app,modules,services,data,integrations,shared,config}/", "tests/");

    const agentFiles = writeAgentInstructions(root, config.projectName, agents, { overwrite: false, onSkip });
    if (agentFiles.length) created.push(...agentFiles);

    spin.stop(`${pc.green("✔")} Retrofitted NEPTR scaffolding`);
  } catch (err) {
    spin.stop(`${pc.red("✘")} Retrofit hit a snag`);
    neptr.warn(err instanceof Error ? err.message : String(err));
  }

  if (flags.index !== false) {
    spin.start("Building the code index + installing hooks");
    try {
      installIndexing(root);
      created.push(".docs/REPO_MAP.md", ".githooks/pre-commit", ".claude/settings.json");
      spin.stop(`${pc.green("✔")} Built the code index + hooks`);
    } catch (err) {
      spin.stop(`${pc.yellow("▲")} Index step skipped`);
      neptr.warn(`Could not build the index (run \`neptr index --setup\` later): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Part A.5: draft Docker files (deterministic, DRAFT-headed) -----------
  let drafts: DockerDraftResult = { written: [], skipped: [] };
  let noDraftReason: string | undefined;
  if (dockerScan) {
    if (dockerScan.existingFiles.length) {
      noDraftReason = "Docker files already exist at the root — the Docker workstream gap-checks them instead.";
    } else if (!dockerScan.hasServer && !dockerScan.hasDb && !dockerScan.hasVite) {
      noDraftReason = "no server, database, or Vite app was detected.";
    } else {
      spin.start("Drafting Docker setup from detected dependencies");
      try {
        drafts = writeDockerDrafts(root, config.projectName, pkg, dockerScan);
        created.push(...drafts.written);
        spin.stop(`${pc.green("✔")} Drafted ${drafts.written.join(", ") || "nothing new"} (DRAFT — the agent verifies)`);
      } catch (err) {
        noDraftReason = `drafting failed: ${err instanceof Error ? err.message : String(err)}`;
        spin.stop(`${pc.yellow("▲")} Docker draft step skipped`);
        neptr.warn(`Could not draft Docker files: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // --- Part B: agent migration workspace ------------------------------------
  let planCreated = false;
  if (flags.plan !== false) {
    if (fs.existsSync(featureDir)) {
      neptr.warn(`${featurePath}/ already exists — leaving it as is. Pick another name with --name to regenerate.`);
    } else {
      const featuresReadme = path.join(root, ".docs", "feature", "README.md");
      if (!fs.existsSync(featuresReadme)) {
        renderFile(".docs/feature/README.md", featuresReadme, {});
      }
      renderDir("adopt", featureDir, {
        projectName: config.projectName,
        stack: vars.stack ?? config.template,
        date: new Date().toISOString().slice(0, 10),
        featurePath,
        inventory: buildInventory(root),
        docsInventory,
        testsInventory,
        dockerInventory: dockerScan
          ? buildDockerInventory(dockerScan, drafts.written, noDraftReason)
          : skipNote("--no-docker"),
        envInventory: buildEnvInventory(root),
        monorepoNote: monorepo
          ? `> **Monorepo detected** (${monorepo}) — NEPTR's layout applies per package; these inventories scan the repo root only. Plan accordingly.`
          : "",
      });
      planCreated = true;
    }
  }

  // --- Summary --------------------------------------------------------------
  const lines: string[] = [];
  if (created.length) lines.push(`${pc.green("created/ensured")}\n  ${created.join("\n  ")}`);
  if (skipped.length) lines.push(`${pc.dim(`left untouched (already existed): ${skipped.length} file(s)`)}`);
  if (planCreated) lines.push(`${pc.green("migration workspace")}\n  ${featurePath}/`);
  p.note(lines.join("\n"), "Adoption summary");

  p.outro("NEPTR has moved in! The boilerplate is baked; now let an agent do the moving.");

  if (planCreated) {
    // Plain console.log so copied prompts don't capture clack's gutter.
    console.log(pc.bold("Next: run each phase with an agent — copy, paste, deploy.\n"));
    console.log(pc.green(pc.bold("1. Plan")) + pc.dim("  — use your smartest model"));
    console.log(
      `Read ${featurePath}/phases/plan.md and follow it exactly: confirm the migration mapping and fill in ${featurePath}/PLAN.md and ${featurePath}/TASKS.md. Do not move files yet.\n`,
    );
    console.log(pc.green(pc.bold("2. Implement")) + pc.dim("  — a cheaper model is fine"));
    console.log(
      `Read ${featurePath}/phases/implement.md and follow it exactly: move the code, tests, and docs per ${featurePath}/PLAN.md and finish the Docker setup, keeping the build green after each batch.\n`,
    );
    console.log(pc.green(pc.bold("3. Review")) + pc.dim("  — back to the smart model"));
    console.log(
      `Read ${featurePath}/phases/review.md and follow it exactly: verify the code only moved (no behaviour change), every doc and test is accounted for, the Docker setup works, then fix any breakage and set the status to done.\n`,
    );
  } else {
    console.log(
      pc.dim("Scaffolding retrofitted. Run `neptr adopt` without --no-plan to also generate the migration workspace.\n"),
    );
  }
  neptr.say("One layer at a time, like a well-structured pie!");
}
