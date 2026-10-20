import type { NextRequest } from "next/server"

import { getRequestSession, unauthorized } from "@/lib/api-route"
import { clearClaudeSeen, getClaudeLastSeen } from "@/lib/agent/status"
import type { ClaudeStatusResponse } from "@/types/api"

/** When the signed-in user's Claude Code last reached the MCP endpoint. */
export async function GET(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const lastSeenAt = await getClaudeLastSeen(session.user.id)
  return Response.json({ lastSeenAt: lastSeenAt?.toISOString() ?? null } satisfies ClaudeStatusResponse)
}

/** Forgets the last-seen time, so the editor reads "Not connected" until Claude calls again. */
export async function DELETE(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  await clearClaudeSeen(session.user.id)
  return Response.json({ lastSeenAt: null } satisfies ClaudeStatusResponse)
}
