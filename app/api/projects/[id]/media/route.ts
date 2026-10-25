import type { NextRequest } from "next/server"

import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { createMedia, listMedia } from "@/lib/media"
import { createMediaSchema } from "@/lib/project/validation"
import { getProject } from "@/lib/projects"
import type { MediaListResponse, MediaResponse } from "@/types/api"

/** The project's uploads, newest first. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/media">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  if (!(await getProject(session.user.id, id))) return notFound("Project not found.")

  const media = await listMedia(id)
  return Response.json({ media } satisfies MediaListResponse)
}

/** Records a file that has finished uploading to ImageKit. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/media">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const parsed = createMediaSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid media.", 400)

  const { id } = await ctx.params
  if (!(await getProject(session.user.id, id))) return notFound("Project not found.")

  const media = await createMedia(session.user.id, id, parsed.data)
  return Response.json({ media } satisfies MediaResponse, { status: 201 })
}
