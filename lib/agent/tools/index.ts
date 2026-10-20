import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"

import { registerMediaTools } from "@/lib/agent/tools/media"

/** Every tool Claude Code gets over MCP (see the plan, §8). More are added here as they're built. */
export function registerAgentTools(server: McpServer) {
  registerMediaTools(server)
}
