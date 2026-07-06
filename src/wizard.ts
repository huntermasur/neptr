import * as p from "@clack/prompts";
import path from "node:path";
import fs from "node:fs";
import pc from "picocolors";
import { bail, ensure } from "./prompts.js";
import {
  AGENT_CHOICES,
  CURATED_SKILLS,
  DEFAULTS,
  MCP_SERVERS,
  VITE_TEMPLATES,
  validateProjectName,
  withDefaults,
  type NEPTRConfig,
  type McpServer,
  type ViteTemplate,
} from "./config.js";

/** Display label for each MCP server; defaults to the id when not listed here. */
const MCP_LABELS: Partial<Record<McpServer, string>> = {
  github: "git/github",
  "sequential-thinking": "sequential thinking",
};

const MCP_HINTS: Record<McpServer, string> = {
  context7: "up-to-date library docs for the agent",
  docker: "manage containers, images, and compose stacks",
  github: "PRs, issues, and repo workflows",
  memory: "persistent knowledge graph for the agent across sessions",
  playwright: "browser automation — let the agent drive your app",
  "sequential-thinking": "structured step-by-step reasoning for complex problems",
};

/** Sentinel value for the "select all" row atop the skills multiselect. */
const SELECT_ALL_SKILLS = "__select_all__";
/** Sentinel value for the "select all" row atop the MCP servers multiselect. */
const SELECT_ALL_MCP = "__select_all_mcp__";

/**
 * Interactive wizard. Anything already provided via flags (in `partial`) is
 * skipped; with --yes every gap is filled from DEFAULTS instead of prompting.
 */
export async function runWizard(partial: Partial<NEPTRConfig>): Promise<NEPTRConfig> {
  if (partial.yes) return withDefaults(partial);

  p.intro(pc.bgGreen(pc.black(" neptr new ")));

  let projectName = partial.projectName;
  if (!projectName) {
    projectName = ensure(
      await p.text({
        message: "What shall we name your new project?",
        placeholder: "my-fresh-app",
        validate: (v) => validateProjectName(v ?? ""),
      }),
    );
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    p.log.error(`Directory ${projectName} already exists here. NEPTR does not overwrite friends.`);
    process.exit(1);
  }

  const template =
    partial.template ??
    ensure(
      await p.select<ViteTemplate>({
        message: "Which Vite template?",
        initialValue: DEFAULTS.template,
        options: VITE_TEMPLATES.map((t) => ({ value: t, label: t })),
      }),
    );

  const mcpSelection =
    partial.mcpServers ??
    ensure(
      await p.multiselect<string>({
        message: "Which MCP servers should the project be wired up with?",
        // The default is every server; showing just the "Select all" row checked
        // keeps the list readable while still installing everything if left as-is.
        initialValues: [SELECT_ALL_MCP],
        required: false,
        options: [
          { value: SELECT_ALL_MCP, label: "Select all" },
          ...MCP_SERVERS.map((s) => ({ value: s, label: MCP_LABELS[s] ?? s, hint: MCP_HINTS[s] })),
        ],
      }),
    );

  // When partial.mcpServers was set, mcpSelection is exactly it and can never
  // contain the sentinel, so this expands "Select all" only for wizard picks.
  const mcpServers = mcpSelection.includes(SELECT_ALL_MCP) ? [...MCP_SERVERS] : (mcpSelection as McpServer[]);

  const skillsSelection =
    partial.skills ??
    ensure(
      await p.multiselect<string>({
        message: "Any skills from skills.sh? (installed via npx skills add)",
        // The default is every curated skill; showing just the "Select all" row
        // checked keeps the list readable while still installing everything.
        initialValues: [SELECT_ALL_SKILLS],
        required: false,
        options: [
          { value: SELECT_ALL_SKILLS, label: "Select all" },
          ...CURATED_SKILLS.map((s) => ({ value: s.installArg, label: s.name, hint: s.hint })),
        ],
      }),
    );

  const skills = skillsSelection.includes(SELECT_ALL_SKILLS)
    ? CURATED_SKILLS.map((s) => s.installArg)
    : skillsSelection;

  const agents =
    partial.agents ??
    ensure(
      await p.multiselect<string>({
        message: "Which AI agents are you using? (AGENTS.md is always included)",
        initialValues: DEFAULTS.agents,
        required: false,
        options: AGENT_CHOICES.map((a) => ({ value: a.id, label: a.label, hint: a.hint })),
      }),
    );

  const docker =
    partial.docker ??
    ensure(await p.confirm({ message: "Set up Docker? (Dockerfile + compose)", initialValue: DEFAULTS.docker }));

  const git =
    partial.git ??
    ensure(await p.confirm({ message: "Initialize git with an initial commit?", initialValue: DEFAULTS.git }));

  const installDeps =
    partial.installDeps ??
    ensure(await p.confirm({ message: "Install dependencies (npm install)?", initialValue: DEFAULTS.installDeps }));

  const summary = [
    `${pc.dim("project")}   ${projectName} (${template})`,
    `${pc.dim("mcp")}       ${mcpServers.length ? mcpServers.join(", ") : "none"}`,
    `${pc.dim("skills")}    ${skills.length ? skills.join(", ") : "none"}`,
    `${pc.dim("agents")}    ${agents.length ? agents.join(", ") : "none"} ${pc.dim("(+ AGENTS.md)")}`,
    `${pc.dim("docker")}    ${docker ? "yes" : "no"}   ${pc.dim("git")} ${git ? "yes" : "no"}   ${pc.dim("install")} ${installDeps ? "yes" : "no"}`,
  ].join("\n");
  p.note(summary, "Here is the plan!");

  const go = ensure(await p.confirm({ message: "NEPTR, deploy?", initialValue: true }));
  if (!go) bail();

  return {
    projectName,
    targetDir,
    template,
    mcpServers,
    skills,
    agents,
    docker,
    git,
    installDeps,
    yes: false,
  };
}
