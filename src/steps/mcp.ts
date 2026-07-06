import fs from "node:fs";
import path from "node:path";
import { MCP_CONFIG_FILES, type NEPTRConfig, type McpServer } from "../config.js";

/**
 * Server entries for the MCP config, understood by Claude Code and other
 * AGENTS.md-era tools (`.mcp.json`) and by Cursor (`.cursor/mcp.json`).
 */
const SERVER_CONFIGS: Record<McpServer, object> = {
  context7: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
  },
  docker: {
    type: "stdio",
    command: "docker",
    args: ["mcp", "gateway", "run"],
  },
  github: {
    type: "http",
    url: "https://api.githubcopilot.com/mcp/",
  },
  memory: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  playwright: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
  "sequential-thinking": {
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  },
};

/** Only runs when at least one server is selected (gated by `enabled` in cli.ts). */
export async function mcpStep(config: NEPTRConfig): Promise<void> {
  const mcpServers = Object.fromEntries(config.mcpServers.map((s) => [s, SERVER_CONFIGS[s]]));
  const json = JSON.stringify({ mcpServers }, null, 2) + "\n";
  // Write to both `.mcp.json` and `.cursor/mcp.json` so Claude and Cursor agree.
  for (const rel of MCP_CONFIG_FILES) {
    const file = path.join(config.targetDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, json);
  }
}
