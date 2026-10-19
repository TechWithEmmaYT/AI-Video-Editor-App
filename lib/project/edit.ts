import type { Op, ProjectData } from "@/lib/project/ops"
import { isRangeFree } from "@/lib/project/placement"
import type { Clip } from "@/lib/project/schema"

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
