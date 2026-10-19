import type { Doc, Transform } from "@/lib/project/schema"

/** True if [from, from + duration) on the track overlaps no clip (optionally ignoring one). */
export function isRangeFree(doc: Doc, trackId: string, from: number, duration: number, ignoreClipId?: string) {
  const end = from + duration
  return doc.clips.every(
    (clip) =>
      clip.trackId !== trackId ||
      clip.id === ignoreClipId ||
      end <= clip.from ||
      from >= clip.from + clip.durationInFrames
  )
}

/** A track holding only audio clips. */
export function isAudioTrack(doc: Doc, trackId: string) {
  const clips = doc.clips.filter((clip) => clip.trackId === trackId)
  return clips.length > 0 && clips.every((clip) => clip.type === "audio")
}

/** Index where the run of audio-only tracks at the bottom begins (tracks.length when there is none). */
export function audioZoneStart(doc: Doc) {
  let index = doc.tracks.length
  while (index > 0 && isAudioTrack(doc, doc.tracks[index - 1].id)) index--
  return index
}

/** A box that fits (contains) a w×h source in the composition, centred. Full canvas when size is unknown. */
export function fitBox(sourceW: number | null, sourceH: number | null, compW: number, compH: number): Transform {
  const full = { x: 0, y: 0, width: compW, height: compH, scale: 1, rotation: 0, opacity: 1 }
  if (!sourceW || !sourceH) return full
  const ratio = Math.min(compW / sourceW, compH / sourceH)
  const width = Math.round(sourceW * ratio)
  const height = Math.round(sourceH * ratio)
  return { ...full, width, height, x: Math.round((compW - width) / 2), y: Math.round((compH - height) / 2) }
}
