import type { NextRequest } from "next/server"

import { getRequestSession, unauthorized } from "@/lib/api-route"
import { getClaudeLastSeen } from "@/lib/agent/status"
import type { ClaudeStatusResponse } from "@/types/api"

/** When the signed-in user's Claude Code last reached the MCP endpoint. */
export async function GET(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const lastSeenAt = await getClaudeLastSeen(session.user.id)
  return Response.json({ lastSeenAt: lastSeenAt?.toISOString() ?? null } satisfies ClaudeStatusResponse)
}
