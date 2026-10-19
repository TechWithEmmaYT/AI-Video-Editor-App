import type { NextRequest } from "next/server"
import { z } from "zod"

import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { opsSchema } from "@/lib/project/ops"
import { applyProjectOps } from "@/lib/projects"
import type { ApplyOpsResponse } from "@/types/api"

const bodySchema = z.object({
  ops: opsSchema,
  /** The editor tab that sent the ops (lets that tab ignore its own echo once live updates land). */
  clientId: z.string().max(64).optional(),
})

export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/ops">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid ops.", 400)

  const { id } = await ctx.params
  const result = await applyProjectOps(session.user.id, id, parsed.data.ops)

  switch (result.status) {
    case "ok":
      return Response.json({ version: result.version } satisfies ApplyOpsResponse)
    case "not-found":
      return notFound("Project not found.")
    case "invalid":
      return errorResponse(result.message, 422)
    case "conflict":
      return errorResponse("The project changed while saving. Reload to continue.", 409)
  }
}
