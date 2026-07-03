import { createRequire } from "node:module";
import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { BMO_BANNER, bmo, randomQuote } from "./theme.js";
import { configFromFlags, type BeemoConfig, type NewFlags } from "./config.js";
import { runWizard } from "./wizard.js";
import type { StepResult } from "./run.js";
import { viteStep } from "./steps/vite.js";
import { aiDocsStep } from "./steps/ai-docs.js";
import { agentsStep } from "./steps/agents.js";
import { mcpStep } from "./steps/mcp.js";
import { dockerStep } from "./steps/docker.js";
import { installStep } from "./steps/install.js";
import { skillsStep } from "./steps/skills.js";
import { codegraphStep } from "./steps/codegraph.js";
import { envStep } from "./steps/env.js";
import { gitStep } from "./steps/git.js";
import { commandExists, run } from "./run.js";
import { doctor } from "./doctor.js";
import { runFeature, type FeatureFlags } from "./feature.js";

interface Step {
  name: string;
  enabled: (c: BeemoConfig) => boolean;
  run: (c: BeemoConfig) => Promise<string | void>;
  /** Manual command shown in the summary if this step fails. */
  fix: (c: BeemoConfig) => string;
  /** When true, a failure aborts the scaffold (nothing to layer onto). */
  critical?: boolean;
}

const STEPS: Step[] = [
  {
    name: "Scaffold Vite app",
    enabled: () => true,
    run: viteStep,
    fix: (c) => `npm create vite@latest ${c.projectName} -- --template ${c.template}`,
    critical: true,
  },
  {
    name: "Generate AI & docs layer",
    enabled: () => true,
    run: aiDocsStep,
    fix: () => "copy templates/.agents and templates/docs from the beemo repo into the project",
  },
  {
    name: "Generate agent instruction files",
    enabled: () => true,
    run: agentsStep,
    fix: () => "create AGENTS.md (and CLAUDE.md etc.) by hand pointing agents at .agents/",
  },
  {
    name: "Configure MCP servers",
    enabled: (c) => c.mcpServers.length > 0,
    run: mcpStep,
    fix: () => "create .mcp.json by hand (see https://docs.claude.com/en/docs/claude-code/mcp)",
  },
  {
    name: "Generate Docker setup",
    enabled: (c) => c.docker,
    run: dockerStep,
    fix: () => "copy templates/docker/* from the beemo repo",
  },
  {
    name: "Install dependencies",
    enabled: (c) => c.installDeps,
    run: installStep,
    fix: () => "npm install",
  },
  {
    name: "Install skills",
    enabled: (c) => c.skills.length > 0,
    run: skillsStep,
    fix: (c) => c.skills.map((s) => `npx skills add ${s} --agent universal -y`).join(" && "),
  },
  {
    name: "Build codegraph index",
    enabled: (c) => c.mcpServers.includes("codegraph"),
    run: codegraphStep,
    fix: () => "npm i -g @colbymchenry/codegraph && codegraph init",
  },
  {
    name: "Generate env files",
    enabled: () => true,
    run: envStep,
    fix: () => "copy .env.example to .env by hand",
  },
  {
    name: "Initialize git",
    enabled: (c) => c.git,
    run: gitStep,
    fix: () => "git init -b main && git add -A && git commit -m 'Initial commit'",
  },
];

async function scaffold(config: BeemoConfig): Promise<void> {
  const results: StepResult[] = [];
  const spinner = p.spinner();

  for (const step of STEPS) {
    if (!step.enabled(config)) {
      results.push({ name: step.name, status: "skipped" });
      continue;
    }
    spinner.start(step.name);
    try {
      const note = await step.run(config);
      results.push({ name: step.name, status: "ok", note: note ?? undefined });
      spinner.stop(`${pc.green("✔")} ${step.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: step.name, status: "failed", note: message, fix: step.fix(config) });
      spinner.stop(`${pc.red("✘")} ${step.name}`);
      if (step.critical) {
        bmo.error(`I could not even start: ${message}`);
        process.exit(1);
      }
      bmo.warn(`${step.name} did not work, but I kept going. You can do it by hand later.`);
    }
  }

  const failed = results.filter((r) => r.status === "failed");
  const lines = results
    .filter((r) => r.status !== "skipped")
    .map((r) => {
      let line = `${r.status === "ok" ? pc.green("✔") : pc.red("✘")} ${r.name}`;
      if (r.note) line += pc.dim(`  — ${r.note}`);
      if (r.status === "failed" && r.fix) line += pc.dim(`\n   → fix (in ${config.projectName}/): ${r.fix}`);
      return line;
    });
  p.note(lines.join("\n"), failed.length ? "Done, with some boo-boos" : "All done!");

  if (failed.length === 0) {
    if (config.docker && !config.yes && (await commandExists("docker", ["info"]))) {
      const build = await p.confirm({ message: "Docker is running — build the images now?", initialValue: false });
      if (build === true) {
        spinner.start("docker compose build");
        try {
          await run("docker", ["compose", "build"], { cwd: config.targetDir, stdio: "pipe", timeout: 600_000 });
          spinner.stop(`${pc.green("✔")} docker compose build`);
        } catch {
          spinner.stop(`${pc.red("✘")} docker compose build — run it manually to see the error`);
        }
      }
    }
    bmo.success(`${config.projectName} is ready! ${randomQuote()}`);
  } else {
    bmo.warn(`${config.projectName} is mostly ready — ${failed.length} step(s) need your help (see above).`);
  }
  console.log(
    `\n  ${pc.bold("Next steps:")}\n` +
      `    cd ${config.projectName}\n` +
      (config.installDeps ? "" : "    npm install\n") +
      `    npm run dev\n`,
  );
}

// package.json ships alongside dist/ in the package, so this resolves both from
// src/ (dev) and from the bundled dist/cli.js.
const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const program = new Command();

program
  .name("beemo")
  .description("BMO-themed project scaffolding — Vite apps with an AI-ready setup baked in")
  .version(version);

program
  .command("new")
  .argument("[name]", "project name")
  .description("Scaffold a new project")
  .option("-t, --template <template>", "Vite template (e.g. react-ts, vue-ts, svelte-ts)")
  .option("--mcp <list>", "comma-separated MCP servers: codegraph,playwright,context7,github (or 'none')")
  .option("--skills <list>", "comma-separated skills.sh sources: owner/repo@skill, or owner/repo for a whole repo (or 'none')")
  .option("--agents <list>", "comma-separated AI agents: claude,copilot,cursor,gemini,codex,opencode (or 'none'); AGENTS.md always included")
  .option("--docker", "generate Docker setup")
  .option("--no-docker", "skip Docker setup")
  .option("--no-git", "skip git init")
  .option("--no-install", "skip npm install")
  .option("-y, --yes", "accept all defaults, no prompts")
  .action(async (name: string | undefined, flags: NewFlags) => {
    console.log(BMO_BANNER);
    bmo.say(randomQuote());
    try {
      const partial = configFromFlags(name, flags);
      const config = await runWizard(partial);
      await scaffold(config);
    } catch (err) {
      bmo.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("Check that your environment has everything Beemo needs")
  .action(async () => {
    console.log(BMO_BANNER);
    bmo.say("I will go into your computer and check it like a magic doctor!\n");
    await doctor();
  });

program
  .command("feature")
  .argument("[description]", "what the feature should do")
  .description("Create a plan → implement → review workspace in .agents/features/")
  .option("-n, --name <name>", "short feature name (becomes the folder slug)")
  .option("-y, --yes", "no prompts (requires --name)")
  .action(async (description: string | undefined, flags: FeatureFlags) => {
    console.log(BMO_BANNER);
    bmo.say(randomQuote());
    try {
      await runFeature(description, flags);
    } catch (err) {
      bmo.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parseAsync();
