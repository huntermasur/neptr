import fs from "node:fs";
import path from "node:path";
import { AGENT_CHOICES, type NEPTRConfig } from "../config.js";

/**
 * Shared directive body every agent instruction file gets. `prefix` rewrites the
 * link targets for files that live below the project root (e.g. `../../` for
 * .cursor/rules/neptr.mdc) so the markdown links resolve; labels stay root-relative.
 */
function agentBody(projectName: string, prefix: string): string {
  const at = (p: string) => `${prefix}${p}`;
  return `# ${projectName} — Agent Instructions

You are working in **${projectName}**, a project scaffolded with NEPTR. Before you do
anything else, read the agent hub. This is mandatory.

## Required reading — always, no exceptions

Read these four files before starting any task, however small:

- [.agents/CONSTITUTION.md](${at(".agents/CONSTITUTION.md")}) — non-negotiable principles
- [.agents/AI_INSTRUCTIONS.md](${at(".agents/AI_INSTRUCTIONS.md")}) — the workflow you must follow
- [.agents/KNOWLEDGE_MAP.md](${at(".agents/KNOWLEDGE_MAP.md")}) — where everything lives and the key files
- [.docs/environment.md](${at(".docs/environment.md")}) — how to run, build, and verify

Do not skip this step or assume you already know the contents. These files override
any assumptions you might have.

## Read as needed — skim by context

The rest of \`.agents/\` and \`.docs/\` is read on demand, only what the current task touches:

- [.agents/CAPABILITIES.md](${at(".agents/CAPABILITIES.md")}) — installed skills & MCP servers and the
  policy for choosing among them; read this **before using any skill or MCP server**
- [.agents/skills/](${at(".agents/skills/")}) — the skills themselves; read a skill's SKILL.md before applying it
- [.docs/feature/](${at(".docs/feature/")}) — in-flight feature workspaces; if your task relates to a
  feature that has a folder here, read its STATUS.md and PLAN.md first
- [.docs/](${at(".docs/")}) — architecture, ADRs, module map, and guides; read only the parts your change affects

## Then follow the workflow

Follow [.agents/AI_INSTRUCTIONS.md](${at(".agents/AI_INSTRUCTIONS.md")}) for the full working
process, including the documentation policy you must apply before finishing.
`;
}

export interface WriteAgentOptions {
  /** When false, an existing instruction file is left untouched (see `neptr adopt`). */
  overwrite?: boolean;
  /** Called with each destination path that was skipped because it already existed. */
  onSkip?: (relPath: string) => void;
}

/**
 * Write the root instruction files for each selected agent, plus AGENTS.md which is
 * always created. Files that map to the same path (e.g. codex + opencode both use
 * AGENTS.md) are written once. Returns the relative paths that were written.
 */
export function writeAgentInstructions(
  targetDir: string,
  projectName: string,
  agents: string[],
  opts: WriteAgentOptions = {},
): string[] {
  // AGENTS.md is always included, regardless of selection.
  const files = new Set<string>(["AGENTS.md"]);
  for (const id of agents) {
    const choice = AGENT_CHOICES.find((a) => a.id === id);
    if (choice) files.add(choice.file);
  }

  const written: string[] = [];
  for (const relPath of files) {
    const destPath = path.join(targetDir, relPath);
    if (opts.overwrite === false && fs.existsSync(destPath)) {
      opts.onSkip?.(relPath);
      continue;
    }
    const depth = relPath.split("/").length - 1;
    let content = agentBody(projectName, "../".repeat(depth));
    // Cursor rule files need frontmatter so the rule is always applied.
    if (relPath.endsWith(".mdc")) {
      content = `---\ndescription: ${projectName} agent instructions\nalwaysApply: true\n---\n\n${content}`;
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content);
    written.push(relPath);
  }

  return written;
}

/**
 * Generate root instruction files for each selected agent, plus AGENTS.md which is
 * always created.
 */
export async function agentsStep(config: NEPTRConfig): Promise<string> {
  const written = writeAgentInstructions(config.targetDir, config.projectName, config.agents);
  return written.join(", ");
}
