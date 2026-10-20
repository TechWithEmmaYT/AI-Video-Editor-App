import { defaultParams } from "@/lib/code-clips/params"
import type { ElementDef, ElementLayout } from "@/lib/elements/types"
import { chooseVisualTrack, type DropTarget } from "@/lib/project/drop"
import { MAX_SECONDS } from "@/lib/project/formats"
import type { Op, ProjectData } from "@/lib/project/ops"
import type { CodeClip, Transform } from "@/lib/project/schema"

/** The box an element gets on a w×h canvas. */
export function elementBox(layout: ElementLayout, w: number, h: number): Transform {
  const base = { scale: 1, rotation: 0, opacity: 1 }
  const short = Math.min(w, h)
  const box = (width: number, height: number, x = (w - width) / 2, y = (h - height) / 2) => ({
    ...base,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  })
  switch (layout) {
    case "full":
      return box(w, h, 0, 0)
    case "title":
      return box(w * 0.84, h * 0.36)
    case "lower-third": {
      const width = w > h ? w * 0.5 : w * 0.86
      const height = short * 0.15
      return box(width, height, w * 0.06, h * 0.86 - height)
    }
    case "square":
      return box(short * 0.4, short * 0.4)
    case "callout":
      return box(short * 0.6, short * 0.42)
  }
}

/** Which layout a clip's box is closest to, for "Save as element". */
export function guessLayout(transform: Transform, w: number, h: number): ElementLayout {
  if (transform.width >= w * 0.95 && transform.height >= h * 0.95) return "full"
  if (transform.y > h * 0.6 && transform.x < w * 0.3) return "lower-third"
  const ratio = transform.width / transform.height
  if (ratio > 0.8 && ratio < 1.25) return "square"
  return ratio > 2 ? "title" : "callout"
}

export function codeClipFromElement(
  element: ElementDef,
  { id, trackId, from, durationInFrames, width, height }: { id: string; trackId: string; from: number; durationInFrames: number; width: number; height: number }
): CodeClip {
  return {
    id,
    trackId,
    type: "code",
    name: element.name,
    color: "code",
    from,
    durationInFrames,
    transform: elementBox(element.layout, width, height),
    code: element.code,
    params: { ...defaultParams(element.paramSchema), ...element.defaultParams },
    paramSchema: element.paramSchema,
    fonts: element.fonts,
    radius: 0,
    // Built-ins and saved elements both record where they came from.
    elementId: element.id,
  }
}

/**
 * The ops that add an element as a code clip at `frame`: on the drop target, or (a click) on the
 * top track that's free there, otherwise a new top track.
 */
export function planElementAdd(
  state: ProjectData,
  element: ElementDef,
  options: { frame: number; target: DropTarget | null; fps: number; width: number; height: number; newId?: () => string }
) {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const maxFrames = MAX_SECONDS * options.fps
  const from = Math.min(Math.max(0, Math.round(options.frame)), maxFrames - 1)
  const durationInFrames = Math.min(Math.max(1, element.defaultDurationInFrames), maxFrames - from)

  const ops: Op[] = []
  const trackId = chooseVisualTrack(state.doc, options.target, from, durationInFrames, (index) => {
    const id = newId()
    ops.push({ type: "addTrack", track: { id }, index })
    return id
  })
  const clip = codeClipFromElement(element, { id: newId(), trackId, from, durationInFrames, width: options.width, height: options.height })
  ops.push({ type: "addClip", clip })

  const end = from + durationInFrames
  if (end > state.durationInFrames) ops.push({ type: "updateProject", patch: { durationInFrames: end } })
  return { ops, clipId: clip.id }
}
