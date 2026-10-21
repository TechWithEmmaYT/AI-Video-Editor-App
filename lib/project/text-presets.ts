import { chooseVisualTrack, type DropTarget } from "@/lib/project/drop"
import { MAX_SECONDS } from "@/lib/project/formats"
import type { Op, ProjectData } from "@/lib/project/ops"
import { CLIP_MOTION_DEFAULTS, type TextClip, type Transform } from "@/lib/project/schema"

/*
 * The Text tab's presets. Sizes are fractions of the canvas's short side, so a Title looks the
 * same in 16:9, 9:16 and 1:1. Every preset uses a font from lib/fonts.ts.
 */

export type TextPresetId = "title" | "subtitle" | "body" | "caption" | "label" | "quote"

type Placement = "center" | "below-center" | "bottom" | "top-left"

export type TextPreset = {
  id: TextPresetId
  name: string
  /** What the new clip says. */
  text: string
  fontFamily: string
  fontWeight: number
  /** Font size as a fraction of the canvas's short side. */
  size: number
  lineHeight: number
  /** Letter spacing in em (stored on the clip in px). */
  tracking: number
  align: TextClip["align"]
  color: string
  placement: Placement
  /** Lines of text the box is sized for. */
  lines: number
  seconds: number
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: "title", name: "Title", text: "Make it move", fontFamily: "Bricolage Grotesque", fontWeight: 800, size: 0.11, lineHeight: 1.02, tracking: -0.03, align: "center", color: "#ffffff", placement: "center", lines: 2, seconds: 3 },
  { id: "subtitle", name: "Subtitle", text: "A short line that sets the scene", fontFamily: "Inter", fontWeight: 600, size: 0.05, lineHeight: 1.2, tracking: -0.01, align: "center", color: "#ffffff", placement: "below-center", lines: 2, seconds: 3 },
  { id: "body", name: "Body", text: "Longer text for explaining an idea, a step or a feature in a sentence or two.", fontFamily: "Inter", fontWeight: 400, size: 0.04, lineHeight: 1.4, tracking: 0, align: "left", color: "#ffffff", placement: "center", lines: 3, seconds: 4 },
  { id: "caption", name: "Caption", text: "This is what a caption looks like", fontFamily: "Inter", fontWeight: 600, size: 0.04, lineHeight: 1.25, tracking: 0, align: "center", color: "#ffffff", placement: "bottom", lines: 2, seconds: 3 },
  { id: "label", name: "Label", text: "NEW FEATURE", fontFamily: "Space Grotesk", fontWeight: 700, size: 0.03, lineHeight: 1.1, tracking: 0.12, align: "left", color: "#f2622e", placement: "top-left", lines: 1, seconds: 3 },
  { id: "quote", name: "Quote", text: "“Simple things, done well.”", fontFamily: "Instrument Serif", fontWeight: 400, size: 0.075, lineHeight: 1.1, tracking: -0.01, align: "center", color: "#ffffff", placement: "center", lines: 2, seconds: 4 },
]

export function findTextPreset(id: string) {
  return TEXT_PRESETS.find((preset) => preset.id === id)
}

/** Where the preset's box sits on a w×h canvas. */
function presetBox(preset: TextPreset, fontSize: number, w: number, h: number): Transform {
  const height = Math.round(fontSize * preset.lineHeight * preset.lines + fontSize * 0.4)
  const base = { scale: 1, rotation: 0, opacity: 1, height }
  switch (preset.placement) {
    case "top-left":
      return { ...base, x: Math.round(w * 0.07), y: Math.round(h * 0.08), width: Math.round(w * 0.6) }
    case "bottom":
      return { ...base, x: Math.round(w * 0.1), y: Math.round(h * 0.88 - height), width: Math.round(w * 0.8) }
    case "below-center":
      return { ...base, x: Math.round(w * 0.1), y: Math.round(h * 0.56), width: Math.round(w * 0.8) }
    case "center": {
      const width = Math.round(w * (preset.align === "left" ? 0.7 : 0.84))
      return { ...base, x: Math.round((w - width) / 2), y: Math.round((h - height) / 2), width }
    }
  }
}

export function textClipFromPreset(
  preset: TextPreset,
  { id, trackId, from, durationInFrames, width, height }: { id: string; trackId: string; from: number; durationInFrames: number; width: number; height: number }
): TextClip {
  const fontSize = Math.round(Math.min(width, height) * preset.size)
  return {
    ...CLIP_MOTION_DEFAULTS,
    id,
    trackId,
    type: "text",
    name: preset.text.length > 40 ? preset.name : preset.text,
    from,
    durationInFrames,
    transform: presetBox(preset, fontSize, width, height),
    text: preset.text,
    fontFamily: preset.fontFamily,
    fontWeight: preset.fontWeight,
    fontSize,
    color: preset.color,
    align: preset.align,
    letterSpacing: Math.round(preset.tracking * fontSize * 10) / 10,
    lineHeight: preset.lineHeight,
  }
}

/**
 * The ops that add a preset as a new text clip at `frame`. With a drop target it lands where it
 * was dropped; without one (a click) it goes on the top track that's free there, or a new top track.
 */
export function planTextAdd(
  state: ProjectData,
  presetId: TextPresetId,
  options: { frame: number; target: DropTarget | null; fps: number; width: number; height: number; newId?: () => string }
) {
  const preset = findTextPreset(presetId)
  if (!preset) return null
  const newId = options.newId ?? (() => crypto.randomUUID())
  const maxFrames = MAX_SECONDS * options.fps
  const from = Math.min(Math.max(0, Math.round(options.frame)), maxFrames - 1)
  const durationInFrames = Math.min(Math.round(preset.seconds * options.fps), maxFrames - from)

  const ops: Op[] = []
  const trackId = chooseVisualTrack(state.doc, options.target, from, durationInFrames, (index) => {
    const id = newId()
    ops.push({ type: "addTrack", track: { id }, index })
    return id
  })
  const clip = textClipFromPreset(preset, { id: newId(), trackId, from, durationInFrames, width: options.width, height: options.height })
  ops.push({ type: "addClip", clip })

  const end = from + durationInFrames
  if (end > state.durationInFrames) ops.push({ type: "updateProject", patch: { durationInFrames: end } })
  return { ops, clipId: clip.id }
}
