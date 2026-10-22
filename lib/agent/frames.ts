import type { Clip, Doc } from "@/lib/project/schema"
import { formatTimestamp } from "@/lib/transcript"

/*
 * render_frames' plain parts (no server-only imports, so tests can run them): which frames to
 * render, what's on screen at each, and quick checks of the doc that point Claude at likely
 * problems before it even looks.
 */

/** Most frames one call renders (each is one image sent to Claude). */
export const MAX_FRAMES = 12
/** Frames sent at detail size (for reading small text or checking an edge). */
export const MAX_DETAIL_FRAMES = 3
export const DEFAULT_FRAMES = 8
/** The long side of a frame, in pixels: small enough to look at a dozen, or big enough for detail. */
export const FRAME_SIZE = 480
export const DETAIL_FRAME_SIZE = 1080

type Range = { durationInFrames: number; fps: number }

/**
 * The frames to render, sorted and without repeats. Exact `times` win; otherwise `count` frames
 * spread over from–to (the middle of each slice, so a cut's first frame isn't picked by chance).
 */
export function pickFrames(project: Range, pick: { times?: number[]; from?: number; to?: number; count?: number }) {
  const last = Math.max(0, project.durationInFrames - 1)
  const toFrame = (seconds: number) => Math.min(last, Math.max(0, Math.round(seconds * project.fps)))

  let frames: number[]
  if (pick.times?.length) {
    frames = pick.times.map(toFrame)
  } else {
    const start = toFrame(pick.from ?? 0)
    const end = pick.to === undefined ? last : toFrame(pick.to)
    const span = Math.max(0, end - start)
    const count = Math.max(1, pick.count ?? DEFAULT_FRAMES)
    frames = count === 1 ? [start] : Array.from({ length: count }, (_, i) => Math.round(start + (span * (i + 0.5)) / count))
  }
  return [...new Set(frames)].sort((a, b) => a - b)
}

const isVisual = (clip: Clip) => clip.type !== "audio"
const covers = (clip: Clip, frame: number) => frame >= clip.from && frame < clip.from + clip.durationInFrames

/** What's on screen at a frame, top track first, e.g. `c12 text "Hook" · c3 video "Speaker"`. */
export function onScreen(doc: Doc, frame: number) {
  const order = new Map(doc.tracks.map((track, index) => [track.id, index]))
  const clips = doc.clips
    .filter((clip) => isVisual(clip) && order.has(clip.trackId) && covers(clip, frame))
    .sort((a, b) => order.get(a.trackId)! - order.get(b.trackId)!)
  if (clips.length === 0) return "nothing (black)"
  return clips.map((clip) => `${clip.id} ${clip.type} "${clip.name}"`).join(" · ")
}

/**
 * Where captions sit in a 9:16 video, as fractions of the canvas: 1080×1920 → x 64, y 1020, 952×400.
 * Below the face and above the app's buttons and caption text at the bottom.
 */
export const CAPTION_SAFE_ZONE = { x: 64 / 1080, y: 1020 / 1920, width: 952 / 1080, height: 400 / 1920 }

/** The caption safe zone on a w×h canvas, in pixels. */
export function captionSafeBox(width: number, height: number) {
  return {
    x: Math.round(width * CAPTION_SAFE_ZONE.x),
    y: Math.round(height * CAPTION_SAFE_ZONE.y),
    width: Math.round(width * CAPTION_SAFE_ZONE.width),
    height: Math.round(height * CAPTION_SAFE_ZONE.height),
  }
}

/** Captions in a 9:16 video must stay inside these (fractions of the canvas), or the app's buttons cover them. */
const CAPTION_LIMITS = { left: 0.05, right: 0.95, top: 0.18, bottom: 0.78 }

const isCaption = (clip: Clip) => clip.type === "code" && !!clip.elementId?.endsWith("-caption")

/** "0:03.2 (frame 96)" */
export const frameLabel = (frame: number, fps: number) => `${formatTimestamp(frame / fps)} (frame ${frame})`

type Canvas = { width: number; height: number; fps: number; durationInFrames: number; format: string }

/**
 * Problems a look at the doc can find on its own: black gaps, black edges, replayed footage, boxes past the canvas edge, text
 * outside the safe zone. Each is one line with the clip id and time, so Claude can fix it.
 */
export function docChecks(doc: Doc, project: Canvas) {
  const problems: string[] = []
  const { width: W, height: H, fps } = project
  const time = (frame: number) => formatTimestamp(frame / fps)

  // Black: frames where no visual clip is on screen.
  const visual = doc.clips.filter(isVisual).sort((a, b) => a.from - b.from)
  let covered = 0
  for (const clip of visual) {
    if (clip.from > covered) problems.push(`Black screen ${time(covered)}–${time(clip.from)}: nothing is on screen there.`)
    covered = Math.max(covered, clip.from + clip.durationInFrames)
  }
  if (visual.length && covered < project.durationInFrames) problems.push(`Black screen ${time(covered)}–${time(project.durationInFrames)} at the end.`)

  // Black edges: something is on screen, but nothing fills the canvas (a video shrunk into a box).
  const fills = (clip: Clip) => {
    if (clip.type === "text" || clip.transform.rotation % 360 !== 0) return false
    const { x, y, width, height, scale } = clip.transform
    const cx = x + width / 2
    const cy = y + height / 2
    return cx - (width * scale) / 2 <= 2 && cy - (height * scale) / 2 <= 2 && cx + (width * scale) / 2 >= W - 2 && cy + (height * scale) / 2 >= H - 2
  }
  let lastEdge = -1
  for (const clip of visual) {
    if (clip.from <= lastEdge) continue
    const onScreenNow = visual.filter((other) => covers(other, clip.from))
    if (onScreenNow.some(fills)) continue
    const shrunk = onScreenNow.find((other) => other.type !== "text")
    if (!shrunk) continue
    const end = shrunk.from + shrunk.durationInFrames
    problems.push(
      `Black edges ${time(clip.from)}–${time(end)}: nothing fills the whole canvas; ${shrunk.id} ${shrunk.type} "${shrunk.name}" is smaller than it (box ${Math.round(shrunk.transform.width * shrunk.transform.scale)}×${Math.round(shrunk.transform.height * shrunk.transform.scale)}). If that isn't on purpose (a card on a backdrop), set its box to the full canvas with scale 1.`
    )
    lastEdge = end - 1
  }

  // Repeats: a clip that picks up right after another of the same file but plays part of it again
  // (usually a re-added speaker clip whose trimStart was left at 0), so speech is heard twice.
  for (const clip of doc.clips) {
    if (clip.type !== "video" && clip.type !== "audio") continue
    const before = doc.clips.find(
      (other) => other.trackId === clip.trackId && other.type === clip.type && other.mediaId === clip.mediaId && other.from + other.durationInFrames === clip.from
    )
    if (!before || (before.type !== "video" && before.type !== "audio")) continue
    const continues = before.trimStartFrames + before.durationInFrames
    if (clip.trimStartFrames < continues) {
      problems.push(
        `${clip.id} ${clip.type} "${clip.name}" at ${time(clip.from)} replays its source from ${time(clip.trimStartFrames)}, but the clip before it already played up to ${time(continues)}: that part is seen and heard twice. To carry on, set its trimStart to ${(continues / fps).toFixed(2)} s.`
      )
    }
  }

  for (const clip of doc.clips) {
    if (clip.type !== "text" && clip.type !== "code") continue
    const { x, y, width, height, scale } = clip.transform
    // The box scales about its centre.
    const cx = x + width / 2
    const cy = y + height / 2
    const left = cx - (width * scale) / 2
    const right = cx + (width * scale) / 2
    const top = cy - (height * scale) / 2
    const bottom = cy + (height * scale) / 2
    const at = `${clip.id} ${clip.type} "${clip.name}" at ${time(clip.from)}`
    const fullFrame = left <= 2 && top <= 2 && right >= W - 2 && bottom >= H - 2
    if (!fullFrame && (left < -2 || top < -2 || right > W + 2 || bottom > H + 2)) {
      problems.push(`${at}: its box goes past the canvas edge, so part of it may be cut off.`)
    } else if (
      isCaption(clip) &&
      project.format === "9:16" &&
      (left < W * CAPTION_LIMITS.left || right > W * CAPTION_LIMITS.right || top < H * CAPTION_LIMITS.top || bottom > H * CAPTION_LIMITS.bottom)
    ) {
      const safe = captionSafeBox(W, H)
      problems.push(
        `${at}: the caption box is outside the caption safe zone, where the app's buttons or the face cover it. Use x ${safe.x}, y ${safe.y}, width ${safe.width}, height ${safe.height}.`
      )
    } else if (clip.type === "text" && project.format === "9:16" && (cy < H * 0.18 || cy > H * 0.75)) {
      problems.push(`${at}: text sits outside the 9:16 safe zone (keep it between 18% and 75% down), where app buttons cover it.`)
    }
  }
  return problems
}
