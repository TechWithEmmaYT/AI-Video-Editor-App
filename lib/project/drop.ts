import { readMediaDragData, type MediaDragPayload } from "@/lib/media-drag"
import { MAX_SECONDS } from "@/lib/project/formats"
import type { Op, ProjectData } from "@/lib/project/ops"
import { audioZoneStart, fitBox, isAudioTrack, isRangeFree } from "@/lib/project/placement"
import type { Clip } from "@/lib/project/schema"

/** Images (and media with an unknown length) get this many seconds on the timeline. */
export const DEFAULT_STILL_SECONDS = 5

/** Where on the timeline the media was dropped. */
export type DropTarget =
  /** Onto an existing track's lane. */
  | { kind: "track"; trackId: string }
  /** Into the gap above/below the tracks: a new track at this index (0 = top). */
  | { kind: "new-track"; index: number }

export type DropOptions = {
  /** Frame under the pointer (already snapped, if snapping is on). */
  frame: number
  target: DropTarget
  fps: number
  /** Composition size, to fit visual media inside the canvas. */
  width: number
  height: number
  newId?: () => string
}

export function mediaClipDuration(media: MediaDragPayload, fps: number) {
  if (media.kind === "image" || !media.durationSec) return DEFAULT_STILL_SECONDS * fps
  return Math.max(1, Math.round(media.durationSec * fps))
}

/**
 * The ops that drop `media` onto the timeline:
 * - the clip starts at the drop frame and lasts the media's length (images 5 s);
 * - audio always goes to the bottom audio track, or a new track at the very bottom;
 * - video/image go on the target track if that spot is free, otherwise on a new track
 *   inserted above it; new visual tracks never go below the audio tracks;
 * - the project grows if the clip ends past its current length.
 */
export function planMediaDrop(state: ProjectData, media: MediaDragPayload, options: DropOptions) {
  const { fps, target } = options
  const newId = options.newId ?? (() => crypto.randomUUID())
  const { doc } = state
  const ops: Op[] = []

  const maxFrames = MAX_SECONDS * fps
  const from = Math.min(Math.max(0, Math.round(options.frame)), maxFrames - 1)
  const durationInFrames = Math.min(mediaClipDuration(media, fps), maxFrames - from)

  const addTrack = (index: number) => {
    const id = newId()
    ops.push({ type: "addTrack", track: { id }, index })
    return id
  }

  let trackId: string
  if (media.kind === "audio") {
    const bottom = doc.tracks.at(-1)
    const reuse = bottom && isAudioTrack(doc, bottom.id) && isRangeFree(doc, bottom.id, from, durationInFrames)
    trackId = reuse ? bottom.id : addTrack(doc.tracks.length)
  } else {
    trackId = chooseVisualTrack(doc, target, from, durationInFrames, addTrack)
  }

  const sourceDurationInFrames = media.durationSec ? Math.max(1, Math.round(media.durationSec * fps)) : null
  const base = {
    id: newId(),
    trackId,
    name: media.name,
    color: media.kind,
    from,
    durationInFrames,
    transform: fitBox(media.width, media.height, options.width, options.height),
    mediaId: media.id,
    src: media.url,
  }

  const clip: Clip =
    media.kind === "video"
      ? { ...base, type: "video", trimStartFrames: 0, sourceDurationInFrames, volume: 1, fit: "cover", radius: 0 }
      : media.kind === "image"
        ? { ...base, type: "image", fit: "cover", radius: 0 }
        : {
            ...base,
            type: "audio",
            transform: fitBox(null, null, options.width, options.height),
            trimStartFrames: 0,
            sourceDurationInFrames,
            volume: 1,
            fadeInFrames: 0,
            fadeOutFrames: 0,
          }
  ops.push({ type: "addClip", clip })

  const end = from + durationInFrames
  if (end > state.durationInFrames) ops.push({ type: "updateProject", patch: { durationInFrames: end } })

  return { ops, clipId: clip.id, trackId }
}

/**
 * The track a visual clip (video, image, text…) goes on:
 * - dropped on a track: that track if the spot is free, otherwise a new track just above it;
 * - dropped in a gap: a new track there;
 * - no target (added by click): the top track that's free at that time, otherwise a new top track.
 * New visual tracks never go below the audio tracks at the bottom.
 */
export function chooseVisualTrack(
  doc: ProjectData["doc"],
  target: DropTarget | null,
  from: number,
  duration: number,
  addTrack: (index: number) => string
) {
  const limit = audioZoneStart(doc)
  if (!target) {
    const free = doc.tracks.slice(0, limit).find((track) => isRangeFree(doc, track.id, from, duration))
    return free ? free.id : addTrack(0)
  }
  if (target.kind === "track") {
    const index = doc.tracks.findIndex((track) => track.id === target.trackId)
    return index !== -1 && isRangeFree(doc, target.trackId, from, duration)
      ? target.trackId
      : addTrack(Math.min(Math.max(index, 0), limit))
  }
  return addTrack(Math.min(Math.max(target.index, 0), limit))
}

/** Reads a drop event's media payload and plans it. Null when the drop isn't a media card. */
export function mediaDropOps(state: ProjectData, dataTransfer: DataTransfer | null, options: DropOptions) {
  const media = readMediaDragData(dataTransfer)
  return media ? planMediaDrop(state, media, options) : null
}
