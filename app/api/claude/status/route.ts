import type { NextRequest } from "next/server"

import { getRequestSession, unauthorized } from "@/lib/api-route"
import { clearClaudeSeen, getClaudeStatus } from "@/lib/agent/status"
import type { ClaudeStatusResponse } from "@/types/api"

/** When the signed-in user's Claude Code last reached the MCP endpoint, and the key it used. */
export async function GET(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const status = await getClaudeStatus(session.user.id)
  return Response.json({ lastSeenAt: status?.lastSeenAt.toISOString() ?? null, keyId: status?.keyId ?? null } satisfies ClaudeStatusResponse)
}

/** Forgets the last-seen time, so the editor reads "Not connected" until Claude calls again. */
export async function DELETE(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  await clearClaudeSeen(session.user.id)
  return Response.json({ lastSeenAt: null, keyId: null } satisfies ClaudeStatusResponse)
}
