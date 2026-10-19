import { APP_NAME } from "@/lib/brand"

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")

export const MCP_URL = `${APP_URL}/api/mcp`

/** The one-line command that adds this app to Claude Code as an MCP server. */
export function mcpAddCommand(apiKey = "<your-api-key>") {
  return `claude mcp add --transport http ${APP_NAME} ${MCP_URL} --header "Authorization: Bearer ${apiKey}"`
}
