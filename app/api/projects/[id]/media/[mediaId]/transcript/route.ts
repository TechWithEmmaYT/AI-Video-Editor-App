import type { NextRequest } from "next/server"
import { z } from "zod"

import { errorResponse, getRequestSession, notFound, unauthorized } from "@/lib/api-route"
import { fetchImageKitTranscript, getOwnedMedia, saveTranscript } from "@/lib/media-transcript"
import { transcriptSchema } from "@/lib/transcript"
import type { TranscriptResponse } from "@/types/api"

type Context = RouteContext<"/api/projects/[id]/media/[mediaId]/transcript">

const bodySchema = z.discriminatedUnion("source", [
  /** Generate with ImageKit's AI transcription (videos). */
  z.object({ source: z.literal("imagekit") }),
  /** The user's own: an .srt/.vtt file or pasted text, already parsed in the browser. */
  z.object({ source: z.literal("user"), transcript: transcriptSchema }),
])

/**
 * Adds a transcript to a media file. ImageKit transcription can take a while: the response is
 * 202 { status: "processing" } until it's ready, so the client asks again.
 */
export async function POST(request: NextRequest, ctx: Context) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid transcript.", 400)

  const { id, mediaId } = await ctx.params
  const row = await getOwnedMedia(session.user.id, id, mediaId)
  if (!row) return notFound("Media not found.")

  if (parsed.data.source === "user") {
    await saveTranscript(row.id, { ...parsed.data.transcript, source: "user" })
    return Response.json({ status: "ready", transcriptSource: "user" } satisfies TranscriptResponse)
  }

  if (row.kind !== "video") return errorResponse("ImageKit transcription works on videos. Add your own transcript for audio.", 422)
  const result = await fetchImageKitTranscript(row.url)
  if (result.status === "processing") return Response.json({ status: "processing" } satisfies TranscriptResponse, { status: 202 })
  if (result.status === "failed") return errorResponse(result.message, 422)

  await saveTranscript(row.id, result.transcript)
  return Response.json({ status: "ready", transcriptSource: "imagekit" } satisfies TranscriptResponse)
}

/** Removes the transcript. */
export async function DELETE(request: NextRequest, ctx: Context) {
  const session = await getRequestSession(request)
  if (!session) return unauthorized()

  const { id, mediaId } = await ctx.params
  const row = await getOwnedMedia(session.user.id, id, mediaId)
  if (!row) return notFound("Media not found.")

  await saveTranscript(row.id, null)
  return Response.json({ status: "ready", transcriptSource: null } satisfies TranscriptResponse)
}
