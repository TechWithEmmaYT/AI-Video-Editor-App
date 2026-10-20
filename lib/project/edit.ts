import type { Op, ProjectData } from "@/lib/project/ops"
import { isRangeFree } from "@/lib/project/placement"
import { FORMATS } from "@/lib/project/formats"
import type { Clip } from "@/lib/project/schema"
import type { ProjectFormat } from "@/types/project"

// Pure helpers that turn an editing action into ops. The editor dispatches the result.

export const clipEnd = (clip: Pick<Clip, "from" | "durationInFrames">) => clip.from + clip.durationInFrames

function findClip(state: ProjectData, clipId: string) {
  return state.doc.clips.find((clip) => clip.id === clipId) ?? null
}

/** Splits a clip in two at `atFrame` (which must fall strictly inside it). Null if it can't. */
export function splitClipOps(state: ProjectData, clipId: string, atFrame: number, newId: () => string) {
  const clip = findClip(state, clipId)
  if (!clip || atFrame <= clip.from || atFrame >= clipEnd(clip)) return null

  const firstLength = atFrame - clip.from
  const second = { ...structuredClone(clip), id: newId(), from: atFrame, durationInFrames: clipEnd(clip) - atFrame } as Clip
  const firstPatch: Record<string, unknown> = { durationInFrames: firstLength }

  // Media keeps playing from where the first half stopped.
  if (second.type === "video" || second.type === "audio") second.trimStartFrames += firstLength
  // Fades stay on the outer ends.
  if (second.type === "audio" && clip.type === "audio") {
    second.fadeInFrames = 0
    firstPatch.fadeOutFrames = 0
  }

  const ops: Op[] = [
    { type: "updateClip", clipId, patch: firstPatch },
    { type: "addClip", clip: second },
  ]
  return { ops, newClipId: second.id }
}

/** A copy placed right after the original, or on a new track above it if that spot is taken. */
export function duplicateClipOps(state: ProjectData, clipId: string, newId: () => string) {
  const clip = findClip(state, clipId)
  if (!clip) return null

  const ops: Op[] = []
  let trackId = clip.trackId
  let from = clipEnd(clip)
  if (!isRangeFree(state.doc, trackId, from, clip.durationInFrames)) {
    trackId = newId()
    from = clip.from
    ops.push({ type: "addTrack", track: { id: trackId }, index: state.doc.tracks.findIndex((t) => t.id === clip.trackId) })
  }
  const copy = { ...structuredClone(clip), id: newId(), trackId, from, name: `${clip.name} copy` } as Clip
  ops.push({ type: "addClip", clip: copy })
  if (clipEnd(copy) > state.durationInFrames) {
    ops.push({ type: "updateProject", patch: { durationInFrames: clipEnd(copy) } })
  }
  return { ops, newClipId: copy.id }
}

/** The parts of a media file Replace needs (a `Media` row or a media drag payload). */
type SourceMedia = { id: string; kind: "video" | "image" | "audio"; name: string; url: string; durationSec: number | null }

/**
 * Swaps a clip's file for another of the same kind, keeping its place, box and settings.
 * Video/audio restart from the new file's beginning and shorten if the new file is shorter.
 * Null if the kinds differ or it's the same file.
 */
export function replaceSourceOps(clip: Clip, media: SourceMedia, fps: number): Op[] | null {
  if (clip.type !== media.kind || !("mediaId" in clip) || clip.mediaId === media.id) return null

  const patch: Record<string, unknown> = { mediaId: media.id, src: media.url, name: media.name }
  if (clip.type === "video" || clip.type === "audio") {
    const sourceFrames = media.durationSec ? Math.max(1, Math.round(media.durationSec * fps)) : null
    patch.trimStartFrames = 0
    patch.sourceDurationInFrames = sourceFrames
    if (sourceFrames !== null && sourceFrames < clip.durationInFrames) patch.durationInFrames = sourceFrames
  }
  return [{ type: "updateClip", clipId: clip.id, patch }]
}

/**
 * Switches the canvas format and refits every clip, as one undoable batch:
 * - a box that filled the old canvas fills the new one;
 * - any other box keeps its size (every format's short side is 1080) with its centre at the
 *   same relative spot, shrinking (text size included) only if it no longer fits.
 * Null when the format doesn't change.
 */
export function changeFormatOps(state: ProjectData, format: ProjectFormat): Op[] | null {
  if (state.format === format) return null
  const from = FORMATS[state.format]
  const to = FORMATS[format]
  const ops: Op[] = [{ type: "updateProject", patch: { format } }]

  for (const clip of state.doc.clips) {
    const t = clip.transform
    const filled = t.x <= 0 && t.y <= 0 && t.x + t.width >= from.width && t.y + t.height >= from.height
    let patch: Record<string, unknown>
    if (filled) {
      patch = { transform: { x: 0, y: 0, width: to.width, height: to.height } }
    } else {
      const k = Math.min(1, to.width / t.width, to.height / t.height)
      const width = Math.max(1, Math.round(t.width * k))
      const height = Math.max(1, Math.round(t.height * k))
      const cx = ((t.x + t.width / 2) / from.width) * to.width
      const cy = ((t.y + t.height / 2) / from.height) * to.height
      patch = { transform: { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height } }
      if (k < 1 && clip.type === "text") {
        patch.fontSize = Math.max(1, Math.round(clip.fontSize * k))
        patch.letterSpacing = Math.round(clip.letterSpacing * k * 10) / 10
      }
    }
    ops.push({ type: "updateClip", clipId: clip.id, patch })
  }
  return ops
}
