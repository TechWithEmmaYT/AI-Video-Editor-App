import type { NextRequest } from "next/server"

import { getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { getProjectWithDoc } from "@/lib/projects"
import type { ProjectDocResponse } from "@/types/api"

/** The project with its doc and version: what the editor reloads when it falls out of step. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/doc">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  const project = await getProjectWithDoc(session.user.id, id)
  if (!project) return notFound("Project not found.")
  return Response.json({ project } satisfies ProjectDocResponse)
}
