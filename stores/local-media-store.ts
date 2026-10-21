import { create } from "zustand"

/*
 * What the editor's preview plays each media file from, for the open project: a blob URL of the
 * copy kept in this browser (lib/local-media.ts), keyed by the file's ImageKit URL (a clip's src).
 * A file that isn't here yet plays from ImageKit. Only the Player reads this; the saved doc and
 * the export keep the ImageKit URLs.
 */

type LocalMediaStore = {
  projectId: string | null
  /** ImageKit URL → blob URL. */
  sources: Record<string, string>
  /** The media ids behind `sources`: their stored copies are in use, so eviction leaves them. */
  mediaIds: string[]
  open: (projectId: string) => void
  /** Frees every blob URL. */
  close: () => void
  /** Plays `src` from `blob` from now on, if that project is still the open one. */
  add: (projectId: string, mediaId: string, src: string, blob: Blob) => void
}

export const useLocalMediaStore = create<LocalMediaStore>((set, get) => ({
  projectId: null,
  sources: {},
  mediaIds: [],

  open: (projectId) => {
    get().close()
    set({ projectId })
  },

  close: () => {
    for (const url of Object.values(get().sources)) URL.revokeObjectURL(url)
    set({ projectId: null, sources: {}, mediaIds: [] })
  },

  add: (projectId, mediaId, src, blob) => {
    const state = get()
    if (state.projectId !== projectId || state.sources[src]) return
    set({ sources: { ...state.sources, [src]: URL.createObjectURL(blob) }, mediaIds: [...state.mediaIds, mediaId] })
  },
}))
