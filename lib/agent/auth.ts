import "server-only"

import type { AuthInfo } from "@modelcontextprotocol/server"

import { markClaudeSeen } from "@/lib/agent/status"
import { auth } from "@/lib/auth"

/**
 * Checks the API key Claude Code sends as `Authorization: Bearer <key>` (see the plan, §8).
 * Returns who it belongs to (`extra.userId`), or undefined, which withMcpAuth turns into a 401.
 * Every accepted request records "last seen" for the Claude tab's status.
 */
export async function verifyAgentToken(_request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined
  const result = await auth.api.verifyApiKey({ body: { key: bearerToken } }).catch(() => null)
  const key = result?.valid ? result.key : null
  if (!key) return undefined

  const userId = key.referenceId
  // Only drives the status dot: never fail Claude's request over it.
  await markClaudeSeen(userId, key.id).catch((error) => console.error("Couldn't record Claude status", error))
  return { token: bearerToken, clientId: key.id, scopes: [], extra: { userId } }
}
