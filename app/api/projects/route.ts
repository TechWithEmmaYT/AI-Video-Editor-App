import type { NextRequest } from "next/server"

import { errorResponse, getRequestSession, unauthorized } from "@/lib/api-route"
import { createProjectSchema } from "@/lib/project/validation"
import { createProject, listProjects } from "@/lib/projects"
import type { ProjectResponse, ProjectsResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const projects = await listProjects(session.user.id)
  return Response.json({ projects } satisfies ProjectsResponse)
}

export async function POST(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const body = await request.json().catch(() => null)
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid project.", 400)

  const project = await createProject(session.user.id, parsed.data)
  return Response.json({ project } satisfies ProjectResponse, { status: 201 })
}
