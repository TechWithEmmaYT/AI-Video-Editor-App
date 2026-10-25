import { produce, type Draft } from "immer"
import { z } from "zod"

import { FORMAT_ORDER, FPS, MAX_SECONDS } from "@/lib/project/formats"
import { clipSchema, sectionSchema, trackSchema, type Clip, type Doc, type Section } from "@/lib/project/schema"
import type { ProjectFormat } from "@/types/project"

/*
 * Every change to a project is an op. The same pure reducer runs in the editor (instantly),
 * in POST /api/projects/[id]/ops (authoritative) and, later, in the MCP tools.
 */

/** What ops act on: the doc plus the project columns an op may change (width/height follow format). */
export type ProjectData = { name: string; durationInFrames: number; format: ProjectFormat; doc: Doc }

const id = z.string().min(1).max(64)
// Patches are shallow records; the full doc is re-validated with docSchema after applying.
const noIdentityChange = (patch: Record<string, unknown>) => !("id" in patch) && !("type" in patch)
const patch = z.record(z.string(), z.unknown()).refine(noIdentityChange, "A patch can't change id or type.")

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addTrack"), track: trackSchema, index: z.number().int().min(0) }),
  z.object({ type: z.literal("removeTrack"), trackId: id }),
  // index (optional) restores array position on undo; order in the array carries no meaning otherwise.
  z.object({ type: z.literal("addClip"), clip: clipSchema, index: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("updateClip"), clipId: id, patch }),
  z.object({ type: z.literal("removeClip"), clipId: id }),
  z.object({ type: z.literal("addSection"), section: sectionSchema, index: z.number().int().min(0).optional() }),
  z.object({ type: z.literal("updateSection"), sectionId: id, patch }),
  z.object({ type: z.literal("removeSection"), sectionId: id }),
  z.object({
    type: z.literal("updateProject"),
    patch: z.object({
      name: z.string().trim().min(1).max(80).optional(),
      durationInFrames: z
        .number()
        .int()
        .min(1)
        .max(MAX_SECONDS * FPS)
        .optional(),
      /** Changes the canvas size; send the clips' refitted boxes in the same batch (changeFormatOps). */
      format: z.enum(FORMAT_ORDER as [ProjectFormat, ...ProjectFormat[]]).optional(),
    }),
  }),
])

// Up to 2000 per save: clearing (or undoing a clear of) a big timeline is one batch.
export const opsSchema = z.array(opSchema).min(1).max(2000)

export type Op = z.infer<typeof opSchema>

export class OpError extends Error {}

function findClip(doc: Draft<Doc> | Doc, clipId: string) {
  const clip = doc.clips.find((c) => c.id === clipId)
  if (!clip) throw new OpError(`Clip ${clipId} not found.`)
  return clip
}

function findSection(doc: Draft<Doc> | Doc, sectionId: string) {
  const section = doc.sections.find((s) => s.id === sectionId)
  if (!section) throw new OpError(`Section ${sectionId} not found.`)
  return section
}

function applyOne(state: Draft<ProjectData>, op: Op) {
  const { doc } = state
  switch (op.type) {
    case "addTrack": {
      if (doc.tracks.some((t) => t.id === op.track.id)) throw new OpError(`Track ${op.track.id} already exists.`)
      doc.tracks.splice(Math.min(op.index, doc.tracks.length), 0, op.track)
      return
    }
    case "removeTrack": {
      const index = doc.tracks.findIndex((t) => t.id === op.trackId)
      if (index === -1) throw new OpError(`Track ${op.trackId} not found.`)
      if (doc.clips.some((c) => c.trackId === op.trackId)) throw new OpError("Only empty tracks can be removed.")
      doc.tracks.splice(index, 1)
      return
    }
    case "addClip": {
      if (doc.clips.some((c) => c.id === op.clip.id)) throw new OpError(`Clip ${op.clip.id} already exists.`)
      doc.clips.splice(op.index ?? doc.clips.length, 0, op.clip)
      return
    }
    case "updateClip": {
      const clip = findClip(doc, op.clipId)
      const { transform, ...rest } = op.patch as Partial<Clip>
      Object.assign(clip, rest)
      // Transform merges one level deep, so Motion can patch just { transform: { x } }.
      if (transform) Object.assign(clip.transform, transform)
      return
    }
    case "removeClip": {
      findClip(doc, op.clipId)
      doc.clips = doc.clips.filter((c) => c.id !== op.clipId)
      return
    }
    case "addSection": {
      if (doc.sections.some((s) => s.id === op.section.id)) throw new OpError(`Section ${op.section.id} already exists.`)
      doc.sections.splice(op.index ?? doc.sections.length, 0, op.section)
      return
    }
    case "updateSection": {
      Object.assign(findSection(doc, op.sectionId), op.patch)
      return
    }
    case "removeSection": {
      findSection(doc, op.sectionId)
      doc.sections = doc.sections.filter((s) => s.id !== op.sectionId)
      return
    }
    case "updateProject": {
      if (op.patch.name !== undefined) state.name = op.patch.name
      if (op.patch.durationInFrames !== undefined) state.durationInFrames = op.patch.durationInFrames
      if (op.patch.format !== undefined) state.format = op.patch.format
      return
    }
  }
}

/** Applies ops in order and returns the new state. Throws OpError on an impossible op. */
export function applyOps(state: ProjectData, ops: Op[]): ProjectData {
  return produce(state, (draft) => {
    for (const op of ops) applyOne(draft, op)
  })
}

function pick<T extends object>(source: T, keys: string[]) {
  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = structuredClone((source as Record<string, unknown>)[key])
  return out
}

/** The op that undoes `op`, computed against the state *before* `op` runs. */
function invertOne(state: ProjectData, op: Op): Op {
  const { doc } = state
  switch (op.type) {
    case "addTrack":
      return { type: "removeTrack", trackId: op.track.id }
    case "removeTrack": {
      const index = doc.tracks.findIndex((t) => t.id === op.trackId)
      return { type: "addTrack", track: structuredClone(doc.tracks[index]), index }
    }
    case "addClip":
      return { type: "removeClip", clipId: op.clip.id }
    case "updateClip":
      return { type: "updateClip", clipId: op.clipId, patch: pick(findClip(doc, op.clipId), Object.keys(op.patch)) }
    case "removeClip":
      return {
        type: "addClip",
        clip: structuredClone(findClip(doc, op.clipId)),
        index: doc.clips.findIndex((c) => c.id === op.clipId),
      }
    case "addSection":
      return { type: "removeSection", sectionId: op.section.id }
    case "updateSection":
      return {
        type: "updateSection",
        sectionId: op.sectionId,
        patch: pick(findSection(doc, op.sectionId), Object.keys(op.patch)),
      }
    case "removeSection":
      return {
        type: "addSection",
        section: structuredClone(findSection(doc, op.sectionId)) as Section,
        index: doc.sections.findIndex((s) => s.id === op.sectionId),
      }
    case "updateProject":
      return {
        type: "updateProject",
        patch: {
          ...(op.patch.name !== undefined && { name: state.name }),
          ...(op.patch.durationInFrames !== undefined && { durationInFrames: state.durationInFrames }),
          ...(op.patch.format !== undefined && { format: state.format }),
        },
      }
  }
}

/** Applies ops and returns the new state plus the ops that undo the whole batch. */
export function applyWithInverse(state: ProjectData, ops: Op[]) {
  const inverse: Op[] = []
  let current = state
  for (const op of ops) {
    inverse.unshift(invertOne(current, op))
    current = applyOps(current, [op])
  }
  return { state: current, inverse }
}

/** Appends removeTrack ops for tracks that this batch leaves empty (keeps the timeline tidy). */
export function withEmptyTrackCleanup(state: ProjectData, ops: Op[]): Op[] {
  const before = new Set(state.doc.clips.map((c) => c.trackId))
  const after = applyOps(state, ops)
  const stillUsed = new Set(after.doc.clips.map((c) => c.trackId))
  const emptied = after.doc.tracks.filter((t) => before.has(t.id) && !stillUsed.has(t.id))
  return [...ops, ...emptied.map((t): Op => ({ type: "removeTrack", trackId: t.id }))]
}

/**
 * Keeps the project exactly as long as its content, so playback stops where the last clip ends.
 * A project with no clips keeps the length it has.
 */
export function withDurationFit(state: ProjectData, ops: Op[]): Op[] {
  const after = applyOps(state, ops)
  const end = Math.max(0, ...after.doc.clips.map((c) => c.from + c.durationInFrames))
  const fitted = Math.min(end, MAX_SECONDS * FPS)
  if (end === 0 || fitted === after.durationInFrames) return ops
  return [...ops, { type: "updateProject", patch: { durationInFrames: fitted } }]
}
