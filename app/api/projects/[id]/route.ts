import type { NextRequest } from "next/server"

import { getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { getProject } from "@/lib/projects"
import type { ProjectResponse } from "@/types/api"

export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  const project = await getProject(session.user.id, id)
  if (!project) return notFound("Project not found.")

  return Response.json({ project } satisfies ProjectResponse)
}
