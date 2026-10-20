import { createMcpHandler, withMcpAuth } from "mcp-handler"

import { verifyAgentToken } from "@/lib/agent/auth"
import { APP_NAME } from "@/lib/brand"

/*
 * The MCP endpoint Claude Code connects to (see the plan, §8): stateless Streamable HTTP, behind
 * an API key sent as `Authorization: Bearer <key>`. Everything MCP lives in lib/agent.
 * Tools are added in the next step; for now it only accepts connections.
 */

const handler = createMcpHandler(
  () => {
    // Tools come next (projects, clips, sections, media, elements, export).
  },
  { serverInfo: { name: APP_NAME, version: "0.1.0" } }
)

const authHandler = withMcpAuth(handler, verifyAgentToken, { required: true })

export { authHandler as DELETE, authHandler as GET, authHandler as POST }
