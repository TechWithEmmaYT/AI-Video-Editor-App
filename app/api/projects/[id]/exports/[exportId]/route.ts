import type { NextRequest } from "next/server"

import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { cancelExport } from "@/lib/exports"
import type { ExportResponse } from "@/types/api"

/** Cancel: stops a running export (its Trigger.dev run) and marks it cancelled. */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/exports/[exportId]">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id, exportId } = await ctx.params
  const result = await cancelExport(session.user.id, id, exportId)
  if (result.status === "not-found") return notFound("Export not found.")
  if (result.status === "finished") return errorResponse("This export has already finished.", 409)

  return Response.json({ export: result.export } satisfies ExportResponse)
}
