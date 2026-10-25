import { tasks } from "@trigger.dev/sdk"

import { errorResponse, getRequestSession, unauthorized } from "@/lib/api-route"
import type { hello } from "@/trigger/hello"

/** Setup check: POST while signed in to trigger the `hello` task. Removed once export works. */
export async function POST(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()
  if (!process.env.TRIGGER_SECRET_KEY) return errorResponse("TRIGGER_SECRET_KEY isn't set in .env.local.", 500)

  const handle = await tasks.trigger<typeof hello>("hello", { name: session.user.name || "there" })
  return Response.json({ runId: handle.id })
}
