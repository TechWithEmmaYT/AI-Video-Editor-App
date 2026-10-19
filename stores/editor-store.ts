import type { PlayerRef } from "@remotion/player"
import { toast } from "sonner"
import { create } from "zustand"

import { applyOpsMutationFn } from "@/lib/api"
import { applyWithInverse, OpError, withDurationFit, withEmptyTrackCleanup, type Op, type ProjectData } from "@/lib/project/ops"
import { docSchema } from "@/lib/project/schema"
import type { ProjectFormat, ProjectWithDoc } from "@/types/project"

/*
 * The editor's single store. Every edit goes through dispatch(ops):
 *   1. the ops run through the shared reducer here, instantly (empty tracks are cleaned up);
 *   2. the result must still be a valid doc (no overlaps etc.), otherwise nothing changes;
 *   3. the batch and its inverse go on the undo stack;
 *   4. the ops are queued to POST /api/projects/[id]/ops, in order.
 */

export type Tool = "select" | "split"
type HistoryEntry = { ops: Op[]; inverse: Op[] }
type SaveStatus = "saved" | "saving" | "error"

export const MIN_PX_PER_SECOND = 20
export const MAX_PX_PER_SECOND = 400
/** 10% along the zoom slider. On load the timeline zooms out further if the clips need it. */
export const DEFAULT_PX_PER_SECOND = MIN_PX_PER_SECOND + (MAX_PX_PER_SECOND - MIN_PX_PER_SECOND) * 0.1

type EditorState = {
  projectId: string
  format: ProjectFormat
  width: number
  height: number
  fps: number
  data: ProjectData
  selectedClipId: string | null

  frame: number
  playing: boolean
  player: PlayerRef | null

  tool: Tool
  snap: boolean
  pxPerSecond: number
  /** Frame of the guide line shown while a drag is snapped, else null. */
  snapLine: number | null

  past: HistoryEntry[]
  future: HistoryEntry[]
  saveStatus: SaveStatus

  init: (project: ProjectWithDoc) => void
  /** Applies a batch as one undoable step. Returns false (and changes nothing) if it's invalid. */
  dispatch: (ops: Op[], options?: { select?: string | null }) => boolean
  undo: () => void
  redo: () => void
  select: (clipId: string | null) => void

  setPlayer: (player: PlayerRef | null) => void
  setFrame: (frame: number) => void
  setPlaying: (playing: boolean) => void
  seek: (frame: number) => void
  /** Pass the click event: browsers only allow audio to start from a user gesture. */
  togglePlay: (event?: React.SyntheticEvent) => void

  setTool: (tool: Tool) => void
  toggleSnap: () => void
  setSnapLine: (frame: number | null) => void
  setPxPerSecond: (px: number) => void
}

const clientId = typeof crypto !== "undefined" ? crypto.randomUUID() : "server"

// Saves run one after another so the server applies ops in the order they happened.
let saveChain: Promise<unknown> = Promise.resolve()
let pendingSaves = 0

const HISTORY_LIMIT = 200

export const useEditorStore = create<EditorState>((set, get) => {
  function save(ops: Op[]) {
    const { projectId } = get()
    pendingSaves++
    set({ saveStatus: "saving" })
    saveChain = saveChain
      .then(() => applyOpsMutationFn({ projectId, ops, clientId }))
      .then(
        () => {
          if (--pendingSaves === 0 && get().saveStatus !== "error") set({ saveStatus: "saved" })
        },
        (error: Error) => {
          pendingSaves--
          set({ saveStatus: "error" })
          toast.error("Couldn’t save your last change", { description: `${error.message} Reload to get back in sync.` })
        }
      )
  }

  /** Applies ops locally; returns the new data or null when they'd break the doc. */
  function tryApply(data: ProjectData, ops: Op[]) {
    try {
      const result = applyWithInverse(data, ops)
      return docSchema.safeParse(result.state.doc).success ? result : null
    } catch (error) {
      if (error instanceof OpError) return null
      throw error
    }
  }

  function keepSelection(data: ProjectData, selected: string | null) {
    return selected && data.doc.clips.some((c) => c.id === selected) ? selected : null
  }

  return {
    projectId: "",
    format: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    data: { name: "", durationInFrames: 1, doc: { tracks: [], clips: [], sections: [] } },
    selectedClipId: null,
    frame: 0,
    playing: false,
    player: null,
    tool: "select",
    snap: true,
    pxPerSecond: DEFAULT_PX_PER_SECOND,
    snapLine: null,
    past: [],
    future: [],
    saveStatus: "saved",

    init: (project) =>
      set({
        projectId: project.id,
        format: project.format,
        width: project.width,
        height: project.height,
        fps: project.fps,
        data: { name: project.name, durationInFrames: project.durationInFrames, doc: project.doc },
        selectedClipId: null,
        frame: 0,
        playing: false,
        tool: "select",
        pxPerSecond: DEFAULT_PX_PER_SECOND,
        past: [],
        future: [],
        saveStatus: "saved",
      }),

    dispatch: (rawOps, options) => {
      const { data, past, selectedClipId } = get()
      let ops: Op[]
      try {
        // Drop tracks the edit emptied, then fit the project length to the clips.
        ops = withDurationFit(data, withEmptyTrackCleanup(data, rawOps))
      } catch (error) {
        if (error instanceof OpError) return false
        throw error
      }
      const result = tryApply(data, ops)
      if (!result) return false

      const selected = options?.select !== undefined ? options.select : selectedClipId
      set({
        data: result.state,
        past: [...past, { ops, inverse: result.inverse }].slice(-HISTORY_LIMIT),
        future: [],
        selectedClipId: keepSelection(result.state, selected),
      })
      save(ops)
      return true
    },

    undo: () => {
      const { past, future, data, selectedClipId } = get()
      const entry = past.at(-1)
      if (!entry) return
      const result = tryApply(data, entry.inverse)
      // An entry that no longer applies (e.g. its clip is gone) is dropped rather than retried forever.
      if (!result) return set({ past: past.slice(0, -1) })
      set({
        data: result.state,
        past: past.slice(0, -1),
        future: [...future, entry],
        selectedClipId: keepSelection(result.state, selectedClipId),
      })
      save(entry.inverse)
    },

    redo: () => {
      const { past, future, data, selectedClipId } = get()
      const entry = future.at(-1)
      if (!entry) return
      const result = tryApply(data, entry.ops)
      if (!result) return set({ future: future.slice(0, -1) })
      set({
        data: result.state,
        past: [...past, entry],
        future: future.slice(0, -1),
        selectedClipId: keepSelection(result.state, selectedClipId),
      })
      save(entry.ops)
    },

    select: (clipId) => set({ selectedClipId: clipId }),

    setPlayer: (player) => set({ player }),
    setFrame: (frame) => set({ frame }),
    setPlaying: (playing) => set({ playing }),
    seek: (frame) => {
      const { player, data } = get()
      const clamped = Math.max(0, Math.min(Math.round(frame), data.durationInFrames - 1))
      player?.seekTo(clamped)
      set({ frame: clamped })
    },
    togglePlay: (event) => get().player?.toggle(event),

    setTool: (tool) => set({ tool }),
    toggleSnap: () => set((state) => ({ snap: !state.snap })),
    setSnapLine: (frame) => get().snapLine !== frame && set({ snapLine: frame }),
    setPxPerSecond: (px) =>
      set({ pxPerSecond: Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, Math.round(px))) }),
  }
})

/** The selected clip, or null. */
export const useSelectedClip = () =>
  useEditorStore((state) => state.data.doc.clips.find((c) => c.id === state.selectedClipId) ?? null)
