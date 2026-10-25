import { createMcpHandler, withMcpAuth } from "mcp-handler"

import { verifyAgentToken } from "@/lib/agent/auth"
import { AGENT_INSTRUCTIONS } from "@/lib/agent/guide"
import { registerAgentTools } from "@/lib/agent/tools"
import { APP_NAME } from "@/lib/brand"

/*
 * The MCP endpoint Claude Code connects to (see the plan, §8): stateless Streamable HTTP, behind
 * an API key sent as `Authorization: Bearer <key>`. Everything MCP lives in lib/agent.
 * The tools are registered in lib/agent/tools.
 */

/** render_frames waits for a render (up to 240 s). */
export const maxDuration = 300

const handler = createMcpHandler(registerAgentTools, {
  serverInfo: { name: APP_NAME, version: "0.1.0" },
  // Sent to Claude Code on connect: start with get_guide, look at videos before editing them.
  instructions: AGENT_INSTRUCTIONS,
})

const authHandler = withMcpAuth(handler, verifyAgentToken, { required: true })

export { authHandler as DELETE, authHandler as GET, authHandler as POST }
