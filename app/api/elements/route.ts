import type { NextRequest } from "next/server"

import { errorResponse, getRequestSession, unauthorized } from "@/lib/api-route"
import { createElement, listElements } from "@/lib/elements"
import { saveElementSchema } from "@/lib/elements/validation"
import type { ElementResponse, ElementsResponse } from "@/types/api"

/** The signed-in user's saved elements ("Mine"), newest first. */
export async function GET(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const elements = await listElements(session.user.id)
  return Response.json({ elements } satisfies ElementsResponse)
}

/** Saves an element. The code goes through the code-clip validator first. */
export async function POST(request: NextRequest) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const parsed = saveElementSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid element.", 400)

  const element = await createElement(session.user.id, parsed.data, "user")
  return Response.json({ element } satisfies ElementResponse, { status: 201 })
}
