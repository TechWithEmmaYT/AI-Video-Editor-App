import { useSyncExternalStore } from "react"

/*
 * The latest error per code clip, from the canvas runtime (remotion/code-clip.tsx), so the Style
 * tab can show it. Lives outside the editor store because the composition also runs in the
 * export render, where there is no editor.
 */

const errors = new Map<string, string>()
const listeners = new Set<() => void>()

export function reportCodeError(clipId: string, message: string | null) {
  if ((errors.get(clipId) ?? null) === message) return
  if (message === null) errors.delete(clipId)
  else errors.set(clipId, message)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCodeError(clipId: string) {
  return useSyncExternalStore(
    subscribe,
    () => errors.get(clipId) ?? null,
    () => null
  )
}
