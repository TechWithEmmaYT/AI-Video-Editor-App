import { z } from "zod"

import { AgentError } from "@/lib/agent/errors"
import { codeClipFromElement } from "@/lib/elements/place"
import type { ElementDef } from "@/lib/elements/types"
import { chooseVisualTrack, mediaClipDuration } from "@/lib/project/drop"
import { FPS, MAX_SECONDS } from "@/lib/project/formats"
import type { Op, ProjectData } from "@/lib/project/ops"
import { fitBox, isAudioTrack, isRangeFree } from "@/lib/project/placement"
import type { Clip, CodeClip, Transform } from "@/lib/project/schema"
import { findTextPreset, textClipFromPreset, type TextPresetId } from "@/lib/project/text-presets"
import type { MediaDragPayload } from "@/lib/media-drag"

/*
 * Claude's add_clip / update_clip, in Claude's terms (seconds, a track choice, a partial box),
 * turned into ops. Pure: the tools resolve media and elements first and pass them in.
 */

const seconds = z.number().min(0).max(MAX_SECONDS)

export const trackChoice = z
  .union([z.enum(["auto", "new-top", "new-bottom"]), z.string().min(1).max(64)])
  .default("auto")
  .describe('"auto" (audio → the bottom audio track, visuals → the top track that\'s free then), "new-top", "new-bottom", or a trackId.')

export const boxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    scale: z.number().positive(),
    rotation: z.number(),
    opacity: z.number().min(0).max(1),
  })
  .partial()
  .describe("Composition pixels; top-left is 0,0. Leave out to use the default box.")

export const addClipSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("media"),
    mediaId: z.string().min(1).max(64).describe("From list_media."),
    at: seconds.describe("Start on the timeline, in seconds."),
    duration: seconds.optional().describe("Seconds. Default: the whole file (images 5 s)."),
    trimStart: seconds.optional().describe("Video/audio: seconds into the source to start from."),
    volume: z.number().min(0).max(2).optional(),
    fit: z.enum(["cover", "contain", "fill"]).optional(),
    radius: z.number().min(0).optional(),
    box: boxSchema.optional(),
    track: trackChoice,
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1).max(5000),
    at: seconds,
    duration: seconds.optional().describe("Seconds. Default: the preset's (3–4 s)."),
    preset: z.enum(["title", "subtitle", "body", "caption", "label", "quote"]).default("title"),
    fontFamily: z.string().max(100).optional(),
    fontWeight: z.number().int().min(100).max(1000).optional(),
    fontSize: z.number().positive().optional(),
    color: z.string().max(32).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    box: boxSchema.optional(),
    track: trackChoice,
  }),
  z.object({
    kind: z.literal("element"),
    elementId: z.string().min(1).max(64).describe('A built-in id (get_guide topic "elements") or a saved element\'s id.'),
    at: seconds,
    duration: seconds.optional().describe("Seconds. Default: the element's."),
    params: z.record(z.string(), z.unknown()).optional().describe("Overrides the element's default params."),
    box: boxSchema.optional(),
    track: trackChoice,
  }),
  z.object({
    kind: z.literal("code"),
    name: z.string().min(1).max(200),
    code: z.string().min(1).max(20_000).describe('The body of function (ctx, t, u, w, h, p, M). See get_guide topic "code-clips".'),
    at: seconds,
    duration: seconds,
    params: z.record(z.string(), z.unknown()).default({}),
    fonts: z.array(z.string().max(100)).max(10).default([]),
    radius: z.number().min(0).default(0),
    box: boxSchema.optional().describe("Default: the whole canvas."),
    track: trackChoice,
  }),
])

export type AddClipSpec = z.output<typeof addClipSchema>

const frames = (s: number) => Math.round(s * FPS)

function withBox(transform: Transform, box: Partial<Transform> | undefined): Transform {
  return { ...transform, ...box }
}

/** The ops for add_clip, and the new clip's id. */
export function addClipOps(
  state: ProjectData,
  spec: AddClipSpec,
  context: { width: number; height: number; newId: () => string; media?: MediaDragPayload | null; element?: ElementDef | null }
) {
  const { width, height, newId } = context
  const from = Math.min(frames(spec.at), MAX_SECONDS * FPS - 1)
  const id = newId()
  // trackId is filled in once the track is chosen (below).
  let clip: Clip

  switch (spec.kind) {
    case "media": {
      const media = context.media
      if (!media) throw new AgentError(`No media file "${spec.mediaId}" in this project. list_media shows them.`)
      const trimStartFrames = spec.trimStart ? frames(spec.trimStart) : 0
      const sourceFrames = media.durationSec ? Math.max(1, Math.round(media.durationSec * FPS)) : null
      const available = sourceFrames ? sourceFrames - trimStartFrames : null
      if (available !== null && available <= 0) throw new AgentError(`trimStart is past the end of "${media.name}".`)
      const wanted = spec.duration ? frames(spec.duration) : media.kind === "image" ? mediaClipDuration(media, FPS) : (available ?? mediaClipDuration(media, FPS))
      const durationInFrames = Math.max(1, available !== null ? Math.min(wanted, available) : wanted)
      const base = {
        id,
        trackId: "",
        name: media.name,
        color: media.kind,
        from,
        durationInFrames,
        mediaId: media.id,
        src: media.url,
        transform: withBox(fitBox(media.kind === "audio" ? null : media.width, media.kind === "audio" ? null : media.height, width, height), spec.box),
      }
      clip =
        media.kind === "video"
          ? { ...base, type: "video", trimStartFrames, sourceDurationInFrames: sourceFrames, volume: spec.volume ?? 1, fit: spec.fit ?? "cover", radius: spec.radius ?? 0 }
          : media.kind === "image"
            ? { ...base, type: "image", fit: spec.fit ?? "cover", radius: spec.radius ?? 0 }
            : { ...base, type: "audio", trimStartFrames, sourceDurationInFrames: sourceFrames, volume: spec.volume ?? 1, fadeInFrames: 0, fadeOutFrames: 0 }
      break
    }
    case "text": {
      const preset = findTextPreset(spec.preset as TextPresetId)!
      const durationInFrames = spec.duration ? frames(spec.duration) : frames(preset.seconds)
      const made = textClipFromPreset({ ...preset, text: spec.text }, { id, trackId: "", from, durationInFrames: Math.max(1, durationInFrames), width, height })
      clip = {
        ...made,
        name: spec.text.length > 40 ? `${spec.text.slice(0, 37)}…` : spec.text,
        ...(spec.fontFamily && { fontFamily: spec.fontFamily }),
        ...(spec.fontWeight && { fontWeight: spec.fontWeight }),
        ...(spec.fontSize && { fontSize: spec.fontSize }),
        ...(spec.color && { color: spec.color }),
        ...(spec.align && { align: spec.align }),
        transform: withBox(made.transform, spec.box),
      }
      break
    }
    case "element": {
      const element = context.element
      if (!element) throw new AgentError(`No element "${spec.elementId}". get_guide({ topic: "elements" }) lists the built-ins.`)
      const durationInFrames = spec.duration ? frames(spec.duration) : element.defaultDurationInFrames
      const made = codeClipFromElement(element, { id, trackId: "", from, durationInFrames: Math.max(1, durationInFrames), width, height })
      clip = { ...made, params: { ...made.params, ...spec.params }, transform: withBox(made.transform, spec.box) }
      break
    }
    case "code": {
      const made: CodeClip = {
        id,
        trackId: "",
        type: "code",
        name: spec.name,
        color: "code",
        from,
        durationInFrames: Math.max(1, frames(spec.duration)),
        transform: withBox({ x: 0, y: 0, width, height, scale: 1, rotation: 0, opacity: 1 }, spec.box),
        code: spec.code,
        params: spec.params,
        paramSchema: [],
        fonts: spec.fonts,
        radius: spec.radius,
      }
      clip = made
      break
    }
  }

  // Clamp to the project's maximum length.
  clip.durationInFrames = Math.max(1, Math.min(clip.durationInFrames, MAX_SECONDS * FPS - from))

  const ops: Op[] = []
  const addTrack = (index: number) => {
    const trackId = newId()
    ops.push({ type: "addTrack", track: { id: trackId }, index })
    return trackId
  }
  const { doc } = state
  const isAudio = clip.type === "audio"
  let trackId: string
  if (spec.track === "auto") {
    if (isAudio) {
      const bottom = doc.tracks.at(-1)
      trackId = bottom && isAudioTrack(doc, bottom.id) && isRangeFree(doc, bottom.id, from, clip.durationInFrames) ? bottom.id : addTrack(doc.tracks.length)
    } else {
      trackId = chooseVisualTrack(doc, null, from, clip.durationInFrames, addTrack)
    }
  } else if (spec.track === "new-top") {
    trackId = addTrack(0)
  } else if (spec.track === "new-bottom") {
    trackId = addTrack(doc.tracks.length)
  } else {
    if (!doc.tracks.some((track) => track.id === spec.track)) throw new AgentError(`No track "${spec.track}". get_project lists the tracks.`)
    if (!isRangeFree(doc, spec.track, from, clip.durationInFrames)) {
      throw new AgentError(`Track ${spec.track} already has a clip in that time range. Use track "auto", "new-top", or another track.`)
    }
    trackId = spec.track
  }

  ops.push({ type: "addClip", clip: { ...clip, trackId } })
  return { ops, clipId: id }
}

export const updateClipSchema = z
  .object({
    name: z.string().min(1).max(200),
    at: seconds.describe("New start on the timeline, in seconds."),
    duration: seconds,
    trimStart: seconds.describe("Video/audio: seconds into the source."),
    trackId: z.string().min(1).max(64).describe("Move to this track (the time range must be free there)."),
    box: boxSchema.describe("Merged into the clip's box."),
    params: z.record(z.string(), z.unknown()).describe("Code clips: merged into the params."),
    text: z.string().max(5000),
    fontFamily: z.string().max(100),
    fontWeight: z.number().int().min(100).max(1000),
    fontSize: z.number().positive(),
    color: z.string().max(32),
    align: z.enum(["left", "center", "right"]),
    letterSpacing: z.number(),
    lineHeight: z.number().positive(),
    volume: z.number().min(0).max(2),
    fit: z.enum(["cover", "contain", "fill"]),
    radius: z.number().min(0),
    fadeIn: seconds.describe("Audio: fade-in seconds."),
    fadeOut: seconds.describe("Audio: fade-out seconds."),
    code: z.string().min(1).max(20_000).describe("Code clips: replaces the code (checked by the validator)."),
    fonts: z.array(z.string().max(100)).max(10),
  })
  .partial()

export type UpdateClipChanges = z.output<typeof updateClipSchema>

/** update_clip's changes as one updateClip op (the server validates the result). */
export function updateClipOps(clip: Clip, changes: UpdateClipChanges): Op[] {
  const { at, duration, trimStart, box, params, fadeIn, fadeOut, ...rest } = changes
  const patch: Record<string, unknown> = { ...rest }
  if (at !== undefined) patch.from = frames(at)
  if (duration !== undefined) patch.durationInFrames = Math.max(1, frames(duration))
  if (trimStart !== undefined) patch.trimStartFrames = frames(trimStart)
  if (fadeIn !== undefined) patch.fadeInFrames = frames(fadeIn)
  if (fadeOut !== undefined) patch.fadeOutFrames = frames(fadeOut)
  if (box) patch.transform = box
  if (params) {
    if (clip.type !== "code") throw new AgentError("params only apply to code clips.")
    patch.params = { ...clip.params, ...params }
  }
  if (Object.keys(patch).length === 0) throw new AgentError("Nothing to change: pass at least one field.")
  return [{ type: "updateClip", clipId: clip.id, patch }]
}
