import path from "node:path";
import { renderDir, renderFile, type TemplateVars } from "../template.js";
import type { NEPTRConfig, ViteTemplate } from "../config.js";

const STACK_NAMES: Record<string, string> = {
  react: "React",
  "react-swc": "React (SWC)",
  vue: "Vue",
  svelte: "Svelte",
  solid: "Solid",
  preact: "Preact",
  lit: "Lit",
  qwik: "Qwik",
  vanilla: "Vanilla",
};

export function stackLabel(template: ViteTemplate): string {
  const isTs = template.endsWith("-ts");
  const base = isTs ? template.slice(0, -3) : template;
  const name = STACK_NAMES[base] ?? base;
  return `${name} + ${isTs ? "TypeScript" : "JavaScript"} + Vite`;
}

export function templateVars(config: NEPTRConfig): TemplateVars {
  const date = new Date().toISOString().slice(0, 10);

  const toolingLines: string[] = [];
  if (config.mcpServers.length) {
    toolingLines.push(`- **MCP servers** (configured in \`.mcp.json\`): ${config.mcpServers.join(", ")}.`);
  }
  if (config.skills.length) {
    toolingLines.push(`- **Skills** installed from skills.sh: ${config.skills.join(", ")}.`);
  }
  if (!toolingLines.length) {
    toolingLines.push("- No MCP servers or skills configured yet.");
  }

  const folderRows: string[] = [];
  if (config.agents.includes("copilot")) folderRows.push("| `.github/` | GitHub Copilot instructions |");
  if (config.agents.includes("cursor")) folderRows.push("| `.cursor/` | Cursor rules |");
  if (config.docker) folderRows.push("| `Dockerfile`, `docker-compose.yml` | Container setup for dev and prod |");

  // Vanilla templates ship no vite.config; the others use .ts or .js to match the template.
  const viteConfigFile = config.template.startsWith("vanilla")
    ? undefined
    : `vite.config.${config.template.endsWith("-ts") ? "ts" : "js"}`;

  return {
    projectName: config.projectName,
    template: config.template,
    stack: stackLabel(config.template),
    date,
    extraCommands: config.docker ? "docker compose up dev   # dev server in Docker\n" : "",
    toolingNotes: toolingLines.join("\n"),
    extraFolderRows: folderRows.join("\n"),
    viteConfigRow: viteConfigFile
      ? `| [../${viteConfigFile}](../${viteConfigFile}) | Vite build/dev configuration |`
      : "",
    extraIndexRows: [
      ...(config.mcpServers.length
        ? [`| [../.mcp.json](../.mcp.json) | MCP server configuration (${config.mcpServers.join(", ")}) |`]
        : []),
      ...(config.docker
        ? ["| [../Dockerfile](../Dockerfile), [../docker-compose.yml](../docker-compose.yml) | Container setup for dev and prod |"]
        : []),
    ].join("\n"),
    stackExtras: config.docker
      ? "- **Containers:** multi-stage Dockerfile (dev server + nginx prod) with docker-compose"
      : "",
    dockerCommands: config.docker
      ? "\n# with Docker\ndocker compose up dev          # dev server with HMR\ndocker compose up prod         # production build behind nginx\n"
      : "",
    aiExtras: config.mcpServers.length
      ? `\nConfigured MCP servers: ${config.mcpServers.join(", ")} (see [.mcp.json](.mcp.json)).`
      : "",
  };
}

/** Generate .agents/, .docs/, and the project README. */
export async function aiDocsStep(config: NEPTRConfig): Promise<void> {
  const vars = templateVars(config);
  const dest = config.targetDir;

  renderDir(".agents", path.join(dest, ".agents"), vars);
  renderDir(".docs", path.join(dest, ".docs"), vars);
  renderFile("project/README.md", path.join(dest, "README.md"), vars);
}
