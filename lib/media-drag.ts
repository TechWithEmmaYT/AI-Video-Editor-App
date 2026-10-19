import { z } from "zod"

import type { Media } from "@/types/project"

/*
 * Drag-and-drop contract between media cards (Media tab) and the timeline.
 * A card calls setMediaDragData(e, media) in onDragStart; the timeline reads it on drop.
 */

export const MEDIA_DRAG_TYPE = "application/x-motion-media"

export type MediaDragPayload = Pick<
  Media,
  "id" | "kind" | "name" | "url" | "thumbnailUrl" | "width" | "height" | "durationSec"
>

const payloadSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "image", "audio"]),
  name: z.string(),
  url: z.url(),
  thumbnailUrl: z.url().nullable(),
  width: z.number().positive().nullable(),
  height: z.number().positive().nullable(),
  durationSec: z.number().positive().nullable(),
})

type HasDataTransfer = { dataTransfer: DataTransfer | null }

/** Call from a media card's onDragStart. Accepts a full Media row; only the payload fields are sent. */
export function setMediaDragData(event: HasDataTransfer, media: MediaDragPayload) {
  if (!event.dataTransfer) return
  const { id, kind, name, url, thumbnailUrl, width, height, durationSec } = media
  const payload: MediaDragPayload = { id, kind, name, url, thumbnailUrl, width, height, durationSec }
  event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = "copy"
}

/** True while dragging media. Works during dragover, when the payload itself is still hidden. */
export function hasMediaDragData(dataTransfer: DataTransfer | null) {
  return !!dataTransfer && Array.from(dataTransfer.types).includes(MEDIA_DRAG_TYPE)
}

/** The dropped media, or null if the drop isn't a (valid) media card. Call in onDrop. */
export function readMediaDragData(dataTransfer: DataTransfer | null): MediaDragPayload | null {
  const raw = dataTransfer?.getData(MEDIA_DRAG_TYPE)
  if (!raw) return null
  try {
    const parsed = payloadSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
