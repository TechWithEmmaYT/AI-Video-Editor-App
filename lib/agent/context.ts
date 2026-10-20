import "server-only"

import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server"

import { AgentError } from "@/lib/agent/errors"

export { AgentError }


/** The user a tool call is for, from the API key verifyAgentToken accepted. */
export function agentUserId(ctx: ServerContext): string {
  const userId = ctx.http?.authInfo?.extra?.userId
  if (typeof userId !== "string") throw new AgentError("Not signed in: connect Claude Code with an API key.")
  return userId
}

/** A plain-text tool result. */
export const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] })

/** A tool result Claude should treat as an error (and can recover from, e.g. by fixing an id). */
export const toolError = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }], isError: true })

/**
 * Wraps a tool handler so every failure reaches Claude as a tool error it can act on.
 * AgentErrors carry their own message (a wrong id, an invalid edit…). Anything unexpected (the
 * database, the network) is logged here and reported without internals like SQL or ids.
 * (Invalid arguments are reported by the MCP server itself, also as tool errors.)
 */
export function handled<Args>(handler: (args: Args, ctx: ServerContext) => Promise<CallToolResult>) {
  return async (args: Args, ctx: ServerContext): Promise<CallToolResult> => {
    try {
      return await handler(args, ctx)
    } catch (error) {
      if (error instanceof AgentError) return toolError(error.message)
      console.error("MCP tool failed", error)
      return toolError(
        "Something went wrong on the server while doing that (not a problem with your request). Try once more; if it keeps failing, tell the user, as the app may need attention."
      )
    }
  }
}
