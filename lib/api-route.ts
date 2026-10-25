import "server-only"

import { auth } from "@/lib/auth"
import type { ApiError } from "@/types/api"

/** The session for a route handler request, or null. */
export function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export function errorResponse(error: string, status: number) {
  return Response.json({ error } satisfies ApiError, { status })
}

export const unauthorized = () => errorResponse("You need to sign in.", 401)
export const notFound = (what = "Not found.") => errorResponse(what, 404)
