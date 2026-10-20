import "server-only"

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { media } from "@/db/schema"
import { fromImageKit, type Transcript } from "@/lib/transcript"

/*
 * Transcripts on media rows. Generating one with ImageKit happens here on the server, once: the
 * result is saved, so reading it later (the editor, Claude) never asks ImageKit again.
 */

/** A media row the user owns in that project, with its transcript. */
export async function getOwnedMedia(userId: string, projectId: string, mediaId: string) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.projectId, projectId), eq(media.userId, userId)))
    .limit(1)
  return row ?? null
}

/** Any media row the user owns, by id (for Claude, which may not name the project). */
export async function getUserMedia(userId: string, mediaId: string) {
  const [row] = await db.select().from(media).where(and(eq(media.id, mediaId), eq(media.userId, userId))).limit(1)
  return row ?? null
}

export async function saveTranscript(mediaId: string, transcript: Transcript | null) {
  await db.update(media).set({ transcript }).where(eq(media.id, mediaId))
}

export type ImageKitTranscriptResult =
  | { status: "ready"; transcript: Transcript }
  | { status: "processing" }
  | { status: "failed"; message: string }

/**
 * ImageKit's AI transcription for a video: {url}/ik-gensubtitle.transcript (word-level JSON) and
 * {url}/ik-genchapter.vtt (chapters), generated together and billed once (2 extension units per
 * minute). ImageKit answers 202 while it's still working; ask again in a few seconds.
 */
export async function fetchImageKitTranscript(videoUrl: string): Promise<ImageKitTranscriptResult> {
  const response = await fetch(`${videoUrl}/ik-gensubtitle.transcript`, { cache: "no-store" })
  if (response.status === 202) return { status: "processing" }
  if (!response.ok) return { status: "failed", message: `ImageKit couldn't transcribe this video (${response.status}).` }

  const json = await response.json().catch(() => null)
  // Chapters come from the same run; they're optional, so a miss here doesn't fail the transcript.
  const chapters = await fetch(`${videoUrl}/ik-genchapter.vtt`, { cache: "no-store" })
    .then((r) => (r.ok && r.status !== 202 ? r.text() : null))
    .catch(() => null)

  const transcript = fromImageKit(json, chapters)
  if (!transcript) return { status: "failed", message: "ImageKit found no speech in this video." }
  return { status: "ready", transcript }
}
