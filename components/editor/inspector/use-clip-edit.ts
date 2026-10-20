"use client"

import { useEffect, useMemo } from "react"

import type { Op } from "@/lib/project/ops"
import type { Clip } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

export type ClipPatch = Record<string, unknown>

/**
 * Editing one clip from the inspector: `preview` while a value is being dragged or typed (on
 * screen only), `commit` when it's settled (one undoable, saved op). `transform` patches merge,
 * so `{ transform: { x: 10 } }` changes only x.
 */
export function useClipEdit(clipId: string) {
  // Leaving the inspector mid-edit (Escape, selecting another clip) saves what's on screen.
  useEffect(() => () => useEditorStore.getState().commitPreview(), [clipId])

  return useMemo(() => {
    const ops = (patch: ClipPatch): Op[] => [{ type: "updateClip", clipId, patch }]
    return {
      preview: (patch: ClipPatch) => useEditorStore.getState().preview(ops(patch)),
      commit: (patch: ClipPatch) => {
        const { previewBase, data, dispatch, cancelPreview } = useEditorStore.getState()
        const before = (previewBase ?? data).doc.clips.find((clip) => clip.id === clipId)
        // Back where it started (e.g. scrubbed and returned): no history entry, no save.
        if (!before || isNoop(before, patch)) return cancelPreview()
        dispatch(ops(patch))
      },
    }
  }, [clipId])
}

function isNoop(clip: Clip, patch: ClipPatch) {
  return Object.entries(patch).every(([key, value]) =>
    key === "transform"
      ? Object.entries(value as object).every(([k, v]) => clip.transform[k as keyof Clip["transform"]] === v)
      : JSON.stringify(clip[key as keyof Clip]) === JSON.stringify(value)
  )
}
