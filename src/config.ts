import fs from "node:fs";
import path from "node:path";

export const VITE_TEMPLATES = [
  "react-ts",
  "react",
  "react-swc-ts",
  "react-swc",
  "vue-ts",
  "vue",
  "svelte-ts",
  "svelte",
  "solid-ts",
  "solid",
  "preact-ts",
  "preact",
  "lit-ts",
  "lit",
  "qwik-ts",
  "qwik",
  "vanilla-ts",
  "vanilla",
] as const;
export type ViteTemplate = (typeof VITE_TEMPLATES)[number];

// IDs are alphabetically ordered so both the wizard list and `--mcp` help text
// read top-to-bottom without needing a separate sort.
export const MCP_SERVERS = ["context7", "docker", "github", "memory", "playwright", "sequential-thinking"] as const;
export type McpServer = (typeof MCP_SERVERS)[number];

/**
 * Files that hold the project's MCP server config, kept in sync so both editors
 * see the same servers: `.mcp.json` (project root) is read by Claude Code and
 * other AGENTS.md-era tools; `.cursor/mcp.json` is read by Cursor. Paths are
 * project-root-relative and use `/` (path.join normalizes them on Windows).
 */
export const MCP_CONFIG_FILES = [".mcp.json", ".cursor/mcp.json"] as const;

/** AI agents that can be wired up. Each maps to a root instruction file. */
export interface AgentChoice {
  id: string;
  label: string;
  /** Path (relative to project root) of the instruction file to generate. */
  file: string;
  hint: string;
}

export const AGENT_CHOICES: AgentChoice[] = [
  { id: "claude", label: "Claude Code", file: "CLAUDE.md", hint: "Anthropic Claude Code" },
  { id: "copilot", label: "GitHub Copilot", file: ".github/copilot-instructions.md", hint: "VS Code / GitHub Copilot" },
  { id: "cursor", label: "Cursor", file: ".cursor/rules/neptr.mdc", hint: "Cursor editor" },
  { id: "gemini", label: "Gemini CLI", file: "GEMINI.md", hint: "Google Gemini CLI" },
  { id: "codex", label: "OpenAI Codex", file: "AGENTS.md", hint: "uses the shared AGENTS.md" },
  { id: "opencode", label: "opencode", file: "AGENTS.md", hint: "uses the shared AGENTS.md" },
];

export const AGENT_IDS = AGENT_CHOICES.map((a) => a.id);

/** Curated shortlist of the most-installed skills on skills.sh (fallback when live fetch fails). */
export interface SkillChoice {
  /**
   * Source passed to `npx skills add`: `owner/repo@skill` pins a single skill,
   * bare `owner/repo` installs every skill in the repo.
   */
  installArg: string;
  name: string;
  hint: string;
}

export const CURATED_SKILLS: SkillChoice[] = [
  { installArg: "vercel-labs/agent-browser@agent-browser", name: "agent-browser", hint: "browser automation for agents" },
  { installArg: "anthropics/skills", name: "anthropics/skills (all)", hint: "installs Anthropic's full official skill collection (frontend-design & ~15 more)" },
  { installArg: "vercel-labs/skills@find-skills", name: "find-skills", hint: "lets your agent discover and install more skills" },
  { installArg: "mattpocock/skills@grill-me", name: "grill-me", hint: "brutally honest code review" },
  { installArg: "pbakaus/impeccable@impeccable", name: "impeccable", hint: "polish UI to a pixel-perfect, production-ready finish" },
  { installArg: "mattpocock/skills@improve-codebase-architecture", name: "improve-codebase-architecture", hint: "reviews and improves codebase architecture" },
  { installArg: "vercel-labs/agent-skills@vercel-react-best-practices", name: "vercel-react-best-practices", hint: "React/Next.js best practices" },
  { installArg: "vercel-labs/agent-skills@web-design-guidelines", name: "web-design-guidelines", hint: "audits UI for accessibility, performance, and UX best practices" },
];

export interface NEPTRConfig {
  projectName: string;
  /** Absolute path of the directory the project is created in. */
  targetDir: string;
  template: ViteTemplate;
  mcpServers: McpServer[];
  /** `npx skills add` sources to install, each `owner/repo@skill` or bare `owner/repo`. */
  skills: string[];
  /** Agent ids selected (see AGENT_CHOICES). AGENTS.md is always generated regardless. */
  agents: string[];
  docker: boolean;
  git: boolean;
  installDeps: boolean;
  /** Accepted all defaults / non-interactive. */
  yes: boolean;
}

/** Raw commander flag values for `neptr new`. */
export interface NewFlags {
  template?: string;
  mcp?: string;
  skills?: string;
  agents?: string;
  docker?: boolean;
  git?: boolean;
  install?: boolean;
  yes?: boolean;
}

export const DEFAULTS = {
  template: "react-ts" as ViteTemplate,
  // Auto-select every MCP server by default; users can trim in the wizard.
  mcpServers: [...MCP_SERVERS] as McpServer[],
  // Auto-select every curated skill by default; users can trim in the wizard.
  skills: CURATED_SKILLS.map((s) => s.installArg) as string[],
  agents: ["claude", "cursor"] as string[],
  docker: true,
  git: true,
  installDeps: true,
};

export function validateProjectName(name: string): string | undefined {
  if (!name) return "Project name is required";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    return "Use lowercase letters, numbers, dots, dashes and underscores (must start with a letter or number)";
  }
  return undefined;
}

function parseList<T extends string>(raw: string | undefined, allowed: readonly T[], label: string): T[] | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim() === "" || raw === "none") return [];
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const item of items) {
    if (!(allowed as readonly string[]).includes(item)) {
      throw new Error(`Unknown ${label} "${item}". Valid options: ${allowed.join(", ")}`);
    }
  }
  return items as T[];
}

/**
 * Merge CLI flags over defaults. Returns a partial config; the wizard fills in
 * anything left undefined (or defaults fill it when --yes).
 */
export function configFromFlags(name: string | undefined, flags: NewFlags): Partial<NEPTRConfig> {
  const partial: Partial<NEPTRConfig> = {};
  if (name !== undefined) {
    const err = validateProjectName(name);
    if (err) throw new Error(err);
    partial.projectName = name;
  }
  if (flags.template !== undefined) {
    if (!(VITE_TEMPLATES as readonly string[]).includes(flags.template)) {
      throw new Error(`Unknown template "${flags.template}". Valid options: ${VITE_TEMPLATES.join(", ")}`);
    }
    partial.template = flags.template as ViteTemplate;
  }
  partial.mcpServers = parseList(flags.mcp, MCP_SERVERS, "MCP server");
  if (flags.skills !== undefined) {
    const skills = flags.skills === "none" || flags.skills.trim() === ""
      ? []
      : flags.skills.split(",").map((s) => s.trim()).filter(Boolean);
    // These go onto an `npx skills add` command line (through a shell on Windows),
    // so reject anything that isn't a plain owner/repo[@skill] source.
    for (const skill of skills) {
      if (!/^[\w.-]+\/[\w.-]+(@[\w.-]+)?$/.test(skill)) {
        throw new Error(`Invalid skill "${skill}". Expected owner/repo or owner/repo@skill`);
      }
    }
    partial.skills = skills;
  }
  partial.agents = parseList(flags.agents, AGENT_IDS, "agent");
  if (flags.docker !== undefined) partial.docker = flags.docker;
  if (flags.git !== undefined) partial.git = flags.git;
  if (flags.install !== undefined) partial.installDeps = flags.install;
  partial.yes = flags.yes ?? false;
  return partial;
}

/** Fill any gaps in a partial config with defaults (used by --yes mode). */
export function withDefaults(partial: Partial<NEPTRConfig>): NEPTRConfig {
  if (!partial.projectName) throw new Error("Project name is required in --yes mode (neptr new <name> --yes)");
  const targetDir = path.resolve(process.cwd(), partial.projectName);
  // The interactive wizard checks this too; --yes skips the wizard, so guard here as well.
  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory ${partial.projectName} already exists here. NEPTR does not overwrite friends.`);
  }
  return {
    projectName: partial.projectName,
    targetDir,
    template: partial.template ?? DEFAULTS.template,
    mcpServers: partial.mcpServers ?? DEFAULTS.mcpServers,
    skills: partial.skills ?? DEFAULTS.skills,
    agents: partial.agents ?? DEFAULTS.agents,
    docker: partial.docker ?? DEFAULTS.docker,
    git: partial.git ?? DEFAULTS.git,
    installDeps: partial.installDeps ?? DEFAULTS.installDeps,
    yes: partial.yes ?? false,
  };
}
