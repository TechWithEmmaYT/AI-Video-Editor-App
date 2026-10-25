import { z } from "zod"

/*
 * The project document: tracks, clips and sections. Shared by the editor, the API,
 * the MCP tools and the Remotion composition. Times are integer frames.
 * Track order: index 0 is the TOP row and draws on top.
 */

const id = z.string().min(1).max(64)
const frames = z.number().int().min(0)
const color = z.string().max(32)

export const transformSchema = z.object({
  /** Top-left corner of the clip box, in composition pixels. */
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  scale: z.number().positive(),
  /** Degrees. */
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
})

const fit = z.enum(["cover", "contain", "fill"])

/**
 * How a clip enters and leaves. The renderer folds these into the clip's own opacity and scale,
 * so any clip type can move without being rewritten as code. Older clips have none ("none").
 */
export const MOTIONS = ["none", "pop", "rise", "scale", "grow", "wipe", "blur"] as const
const motion = z.enum(MOTIONS).default("none")
const motionFrames = z.number().int().min(0).max(120).default(8)

const clipBase = {
  id,
  trackId: id,
  name: z.string().max(200),
  color,
  from: frames,
  durationInFrames: z.number().int().min(1),
  transform: transformSchema,
  animateIn: motion,
  animateInFrames: motionFrames,
  animateOut: motion,
  animateOutFrames: motionFrames,
}

export const videoClipSchema = z.object({
  ...clipBase,
  type: z.literal("video"),
  mediaId: id,
  src: z.url(),
  /** Frames skipped at the start of the source ("starts at"). */
  trimStartFrames: frames,
  /** Length of the source file, so trims can't run past it. Null when unknown. */
  sourceDurationInFrames: z.number().int().positive().nullable(),
  volume: z.number().min(0).max(2),
  fit,
  /** Rounded corners, so b-roll can sit in a card on black. Older clips have none (0). */
  radius: z.number().min(0).default(0),
})

export const imageClipSchema = z.object({
  ...clipBase,
  type: z.literal("image"),
  mediaId: id,
  src: z.url(),
  fit,
  radius: z.number().min(0),
})

export const audioClipSchema = z.object({
  ...clipBase,
  type: z.literal("audio"),
  mediaId: id,
  src: z.url(),
  trimStartFrames: frames,
  sourceDurationInFrames: z.number().int().positive().nullable(),
  volume: z.number().min(0).max(2),
  fadeInFrames: frames,
  fadeOutFrames: frames,
})

export const textClipSchema = z.object({
  ...clipBase,
  type: z.literal("text"),
  text: z.string().max(5000),
  fontFamily: z.string().max(100),
  fontWeight: z.number().int().min(100).max(1000),
  fontSize: z.number().positive(),
  color,
  align: z.enum(["left", "center", "right"]),
  letterSpacing: z.number(),
  lineHeight: z.number().positive(),
})

export const paramDefSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().max(100),
  type: z.enum(["number", "color", "text", "select", "boolean", "font", "image"]),
  default: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.string()).optional(),
})

export const codeClipSchema = z.object({
  ...clipBase,
  type: z.literal("code"),
  code: z.string().max(20_000),
  params: z.record(z.string(), z.unknown()),
  paramSchema: z.array(paramDefSchema),
  fonts: z.array(z.string().max(100)),
  radius: z.number().min(0),
  elementId: id.optional(),
})

export const clipSchema = z.discriminatedUnion("type", [
  videoClipSchema,
  imageClipSchema,
  audioClipSchema,
  textClipSchema,
  codeClipSchema,
])

export const trackSchema = z.object({ id, name: z.string().max(100).optional() })

export const sectionSchema = z
  .object({ id, name: z.string().max(100), from: frames, to: frames, color })
  .refine((section) => section.to > section.from, "A section must end after it starts.")

export const docSchema = z
  .object({
    tracks: z.array(trackSchema),
    clips: z.array(clipSchema),
    sections: z.array(sectionSchema),
  })
  .superRefine((doc, ctx) => {
    const trackIds = new Set(doc.tracks.map((track) => track.id))
    if (trackIds.size !== doc.tracks.length) ctx.addIssue({ code: "custom", message: "Track ids must be unique." })

    const clipIds = new Set<string>()
    for (const clip of doc.clips) {
      if (clipIds.has(clip.id)) ctx.addIssue({ code: "custom", message: `Duplicate clip id ${clip.id}.` })
      clipIds.add(clip.id)
      if (!trackIds.has(clip.trackId)) {
        ctx.addIssue({ code: "custom", message: `Clip ${clip.id} is on a track that doesn't exist.` })
      }
    }

    for (const trackId of trackIds) {
      const clips = doc.clips.filter((clip) => clip.trackId === trackId).sort((a, b) => a.from - b.from)
      for (let i = 1; i < clips.length; i++) {
        if (clips[i].from < clips[i - 1].from + clips[i - 1].durationInFrames) {
          ctx.addIssue({ code: "custom", message: `Clips ${clips[i - 1].id} and ${clips[i].id} overlap.` })
        }
      }
    }
  })

export type Transform = z.infer<typeof transformSchema>
export type VideoClip = z.infer<typeof videoClipSchema>
export type ImageClip = z.infer<typeof imageClipSchema>
export type AudioClip = z.infer<typeof audioClipSchema>
export type TextClip = z.infer<typeof textClipSchema>
export type CodeClip = z.infer<typeof codeClipSchema>
export type ParamDef = z.infer<typeof paramDefSchema>
export type Clip = z.infer<typeof clipSchema>
export type ClipType = Clip["type"]
export type Track = z.infer<typeof trackSchema>
export type Section = z.infer<typeof sectionSchema>
export type Doc = z.infer<typeof docSchema>

export const EMPTY_DOC: Doc = { tracks: [], clips: [], sections: [] }

/** The motion fields a freshly built clip starts with: none, until something sets them. */
export const CLIP_MOTION_DEFAULTS = {
  animateIn: "none",
  animateInFrames: 8,
  animateOut: "none",
  animateOutFrames: 8,
} as const satisfies Pick<Clip, "animateIn" | "animateInFrames" | "animateOut" | "animateOutFrames">
