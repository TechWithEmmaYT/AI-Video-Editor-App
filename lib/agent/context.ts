import "server-only"

import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server"

/** The user a tool call is for, from the API key verifyAgentToken accepted. */
export function agentUserId(ctx: ServerContext): string {
  const userId = ctx.http?.authInfo?.extra?.userId
  if (typeof userId !== "string") throw new Error("Not signed in: connect Claude Code with an API key.")
  return userId
}

/** A plain-text tool result. */
export const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] })

/** A tool result Claude should treat as an error (and can recover from, e.g. by fixing an id). */
export const toolError = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }], isError: true })
