import type { NextRequest } from "next/server"

import { getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { getProjectWithDoc } from "@/lib/projects"
import { projectChannel, subscribe } from "@/lib/realtime/bus"

// A stream stays open up to ~290 s, then closes itself; EventSource reconnects with Last-Event-ID.
export const maxDuration = 300

const PING_MS = 15_000
const CLOSE_MS = 290_000

/**
 * Live updates for a project (see the plan, §5.3): every saved batch of ops, from any editor tab or
 * from Claude, and files Claude adds. Starts by replaying what a reconnecting tab missed, then a
 * `hello` with the current version so the tab can tell whether it's behind.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/events">) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id } = await ctx.params
  const project = await getProjectWithDoc(session.user.id, id)
  if (!project) return notFound("Project not found.")

  const encoder = new TextEncoder()
  const lastEventId = request.headers.get("last-event-id")

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let unsubscribe = () => {}
      const write = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text))
      }
      const close = () => {
        if (closed) return
        closed = true
        clearInterval(ping)
        clearTimeout(timer)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }
      const ping = setInterval(() => write(": ping\n\n"), PING_MS)
      const timer = setTimeout(close, CLOSE_MS)
      request.signal.addEventListener("abort", close)

      // Replays what a reconnecting tab missed, then streams new events.
      unsubscribe = await subscribe(projectChannel(id), lastEventId, (eventId, event) => {
        write(`id: ${eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      })
      if (closed) return unsubscribe() // the tab left while we were subscribing
      write(`event: hello\ndata: ${JSON.stringify({ version: project.version })}\n\n`)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
