import type { NextRequest } from "next/server"
import { z } from "zod"

import { setEditorState } from "@/lib/agent/editor-state"
import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { getProject } from "@/lib/projects"

const bodySchema = z.object({
  projectId: z.string().min(1).max(64),
  selectedClipId: z.string().min(1).max(64).nullable(),
})

/** The editor reports what's open (on load and when the selection changes), so Claude knows what "this" is. */
export async function POST(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse("Invalid editor state.", 400)
  if (!(await getProject(session.user.id, parsed.data.projectId))) return notFound("Project not found.")

  await setEditorState(session.user.id, parsed.data.projectId, parsed.data.selectedClipId)
  return new Response(null, { status: 204 })
}
