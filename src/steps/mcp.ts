import fs from "node:fs";
import path from "node:path";
import type { NEPTRConfig, McpServer } from "../config.js";

/**
 * Server entries for .mcp.json (project-scoped MCP config, understood by
 * Claude Code and other AGENTS.md-era tools).
 */
const SERVER_CONFIGS: Record<McpServer, object> = {
  playwright: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
  context7: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
  },
  github: {
    type: "http",
    url: "https://api.githubcopilot.com/mcp/",
  },
};

/** Only runs when at least one server is selected (gated by `enabled` in cli.ts). */
export async function mcpStep(config: NEPTRConfig): Promise<void> {
  const mcpServers = Object.fromEntries(config.mcpServers.map((s) => [s, SERVER_CONFIGS[s]]));
  const file = path.join(config.targetDir, ".mcp.json");
  fs.writeFileSync(file, JSON.stringify({ mcpServers }, null, 2) + "\n");
}
