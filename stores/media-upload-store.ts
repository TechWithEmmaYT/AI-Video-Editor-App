import { create } from "zustand"

import type { MediaKind } from "@/types/project"

/*
 * Uploads in flight live here rather than in the Media panel, so they keep running (and keep
 * their progress ring) when the panel unmounts: switching tabs or selecting a clip.
 */

export type PendingUpload = {
  id: string
  projectId: string
  name: string
  kind: MediaKind
  /** A local object URL, so the card can show the file while it uploads. */
  previewUrl: string
  /** 0–100. */
  progress: number
}

// AbortControllers aren't UI state, so they sit next to the store rather than in it.
const controllers = new Map<string, AbortController>()

type MediaUploadStore = {
  pending: PendingUpload[]
  /** Adds an upload and returns the controller that cancels it. */
  start: (upload: PendingUpload) => AbortController
  setProgress: (id: string, progress: number) => void
  /** Removes an upload once it succeeds, fails or is cancelled. */
  finish: (id: string) => void
  cancel: (id: string) => void
}

export const useMediaUploadStore = create<MediaUploadStore>((set) => ({
  pending: [],

  start: (upload) => {
    const controller = new AbortController()
    controllers.set(upload.id, controller)
    set((state) => ({ pending: [...state.pending, upload] }))
    return controller
  },

  setProgress: (id, progress) =>
    set((state) => ({ pending: state.pending.map((item) => (item.id === id ? { ...item, progress } : item)) })),

  finish: (id) => {
    controllers.delete(id)
    set((state) => ({ pending: state.pending.filter((item) => item.id !== id) }))
  },

  cancel: (id) => controllers.get(id)?.abort(),
}))
