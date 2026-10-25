import type { NextRequest } from "next/server"

import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { listExports, startExport } from "@/lib/exports"
import { getProject } from "@/lib/projects"
import type { ExportResponse, ExportsResponse } from "@/types/api"

/** The project's recent exports, newest first. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/exports">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  if (!(await getProject(session.user.id, id))) return notFound("Project not found.")

  return Response.json({ exports: await listExports(session.user.id, id) } satisfies ExportsResponse)
}

/** Export now: renders the project as it is now (see the plan, §9). Progress arrives as `export` events. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/exports">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  const result = await startExport(session.user.id, id)
  if (result.status === "not-found") return notFound("Project not found.")
  if (result.status === "busy") return errorResponse("This project is already exporting.", 409)

  return Response.json({ export: result.export } satisfies ExportResponse, { status: 201 })
}
