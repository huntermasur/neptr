import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import { Command } from "commander";
import pc from "picocolors";
import { type AdoptFlags, runAdopt } from "./adopt.js";
import { type ClearFlags, runClear } from "./clear.js";
import { configFromFlags, type NEPTRConfig, type NewFlags } from "./config.js";
import { doctor } from "./doctor.js";
import { type FeatureFlags, runFeature } from "./feature.js";
import { type IndexFlags, runIndex } from "./indexer.js";
import { type McpFlags, runMcp } from "./mcp.js";
import type { StepResult } from "./run.js";
import { commandExists, run } from "./run.js";
import { runSkill, type SkillFlags } from "./skill.js";
import { agentsStep } from "./steps/agents.js";
import { aiDocsStep } from "./steps/ai-docs.js";
import { dockerStep } from "./steps/docker.js";
import { envStep } from "./steps/env.js";
import { gitStep } from "./steps/git.js";
import { indexingStep } from "./steps/indexing.js";
import { installStep } from "./steps/install.js";
import { mcpStep } from "./steps/mcp.js";
import { skillsStep } from "./steps/skills.js";
import { srcLayoutStep } from "./steps/src-layout.js";
import { viteStep } from "./steps/vite.js";
import { NEPTR_BANNER, neptr, randomQuote } from "./theme.js";
import { runWizard } from "./wizard.js";

interface Step {
  name: string;
  enabled: (c: NEPTRConfig) => boolean;
  // biome-ignore lint/suspicious/noConfusingVoidType: steps return a note string or nothing; Promise<void> steps must stay assignable
  run: (c: NEPTRConfig) => Promise<string | void>;
  /** Manual command shown in the summary if this step fails. */
  fix: (c: NEPTRConfig) => string;
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
    name: "Lay out src/ sections",
    enabled: () => true,
    run: srcLayoutStep,
    fix: () => "create src/{app,modules,services,data,integrations,shared,config}/ and tests/ by hand",
  },
  {
    name: "Generate AI & docs layer",
    enabled: () => true,
    run: aiDocsStep,
    fix: () => "copy templates/.agents and templates/.docs from the neptr repo into the project",
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
    fix: () => "create .mcp.json and .cursor/mcp.json by hand (see https://docs.claude.com/en/docs/claude-code/mcp)",
  },
  {
    name: "Generate Docker setup",
    enabled: (c) => c.docker,
    run: dockerStep,
    fix: () => "copy templates/docker/* from the neptr repo",
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
    name: "Generate env files",
    enabled: () => true,
    run: envStep,
    fix: () => "copy .env.example to .env by hand",
  },
  {
    name: "Set up code indexing",
    enabled: () => true,
    run: indexingStep,
    fix: () => "run `neptr index --setup` inside the project to build the map and install its hooks",
  },
  {
    name: "Initialize git",
    enabled: (c) => c.git,
    run: gitStep,
    fix: () => "git init -b main && git add -A && git commit -m 'Initial commit'",
  },
];

async function scaffold(config: NEPTRConfig): Promise<void> {
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
        neptr.error(`I could not even start: ${message}`);
        // Exit gracefully (drain the loop) instead of force-closing handles,
        // which crashes libuv on Windows when network/child I/O is mid-teardown.
        process.exitCode = 1;
        return;
      }
      neptr.warn(`${step.name} burnt a little, but I kept baking. You can finish it by hand later.`);
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
  p.note(lines.join("\n"), failed.length ? "Done, but the pie has burnt edges" : "Fresh out of the oven!");

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
    neptr.success(`${config.projectName} is ready! ${randomQuote()}`);
  } else {
    neptr.warn(`${config.projectName} is mostly ready — ${failed.length} step(s) need your help (see above).`);
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
  .name("neptr")
  .description("NEPTR-themed project scaffolding — Vite apps with an AI-ready setup baked in")
  .version(version);

program
  .command("new")
  .argument("[name]", "project name")
  .description("Scaffold a new project")
  .option("-t, --template <template>", "Vite template (e.g. react-ts, vue-ts, svelte-ts)")
  .option("--mcp <list>", "comma-separated MCP servers: context7,playwright (or 'none')")
  .option(
    "--skills <list>",
    "comma-separated skills.sh sources: owner/repo@skill, or owner/repo for a whole repo (or 'none')",
  )
  .option(
    "--agents <list>",
    "comma-separated AI agents: claude,copilot,cursor,gemini,codex,opencode (or 'none'); AGENTS.md always included",
  )
  .option("--docker", "generate Docker setup")
  .option("--no-docker", "skip Docker setup")
  .option("--no-git", "skip git init")
  .option("--no-install", "skip npm install")
  .option("-y, --yes", "accept all defaults, no prompts")
  .action(async (name: string | undefined, flags: NewFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      const partial = configFromFlags(name, flags);
      const config = await runWizard(partial);
      await scaffold(config);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Check that your environment has everything NEPTR needs")
  .action(async () => {
    console.log(NEPTR_BANNER);
    neptr.say("I will go into your computer and check it like a magic doctor!\n");
    await doctor();
  });

program
  .command("adopt")
  .description(
    "Retrofit NEPTR's scaffolding into the current project and generate an agent plan to restructure code, tests, docs, and Docker into NEPTR's layout",
  )
  .option("-n, --name <name>", "slug for the migration workspace (default adopt-neptr-layout)")
  .option(
    "--agents <list>",
    "comma-separated AI agents: claude,copilot,cursor,gemini,codex,opencode (or 'none'); AGENTS.md always included",
  )
  .option("--no-index", "skip building the code index and installing its hooks")
  .option("--no-plan", "only retrofit the scaffolding; do not generate the migration workspace")
  .option("--no-docs", "skip the documentation inventory + migration workstream")
  .option("--no-tests", "skip the test inventory + migration workstream")
  .option("--no-docker", "skip server/db detection, draft Docker files, and the Docker workstream")
  .option("-y, --yes", "accept all defaults, no prompts")
  .action(async (flags: AdoptFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      await runAdopt(flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("feature")
  .argument("[description]", "what the feature should do")
  .description("Create a plan → implement → review workspace in .docs/feature/")
  .option("-n, --name <name>", "short feature name (becomes the folder slug)")
  .option("-y, --yes", "no prompts (requires --name)")
  .action(async (description: string | undefined, flags: FeatureFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      await runFeature(description, flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("clear")
  .description("Remove feature workspaces in .docs/feature/ created by `neptr feature`")
  .option("-y, --yes", "delete without prompting")
  .action(async (flags: ClearFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      await runClear(flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("skill")
  .argument("[query...]", "what kind of skill to search for")
  .description("Search skills.sh for security-checked skills and install them into this project")
  .option("--min-installs <n>", "minimum install count to consider a skill (default 1000)")
  .option("--limit <n>", "max number of skills to fetch and offer (default 20)")
  .option("--include-unverified", "also show skills with audit warnings or no audits yet")
  .option("--search-only", "list matching security-checked skills without installing (for planning)")
  .option("-y, --yes", "install every shown (audit-passing) skill without prompting")
  .action(async (query: string[], flags: SkillFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      await runSkill(query.join(" "), flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("mcp")
  .argument("[query...]", "what kind of MCP server to search for")
  .description(
    "Search the official MCP registry for safety-checked servers and add them to this project's .mcp.json and .cursor/mcp.json",
  )
  .option("--limit <n>", "max number of servers to fetch and offer (default 12)")
  .option("--include-unverified", "also show servers with a caution/avoid verdict, not just safe ones")
  .option("--search-only", "list matching safety-checked servers without installing (for planning)")
  .option("-y, --yes", "add every shown (safe) server without prompting")
  .action(async (query: string[], flags: McpFlags) => {
    console.log(NEPTR_BANNER);
    neptr.say(randomQuote());
    try {
      await runMcp(query.join(" "), flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("index")
  .description("Build/refresh the repo map Claude Code reads (.docs/REPO_MAP.md + KNOWLEDGE_MAP tables)")
  .option("--quiet", "minimal output — used by the SessionStart and pre-commit hooks")
  .option("--setup", "also install the SessionStart + pre-commit automation in this project (retrofit)")
  .option("--check", "exit non-zero if the map is out of date; write nothing (CI guard)")
  .action(async (flags: IndexFlags) => {
    if (!flags.quiet) {
      console.log(NEPTR_BANNER);
      neptr.say(randomQuote());
    }
    try {
      await runIndex(flags);
    } catch (err) {
      neptr.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program.parseAsync();
