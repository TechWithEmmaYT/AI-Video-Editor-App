"use client"

import { useEffect } from "react"

import { splitClipOps } from "@/lib/project/edit"
import { useEditorStore } from "@/stores/editor-store"

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return !!element?.closest("input, textarea, select, [contenteditable=true], [role=slider]")
}

/**
 * Space play/pause · ←/→ step a frame (⇧ a second) · ⌫ delete · S split at playhead ·
 * V select tool · C split tool · ⌘Z undo · ⇧⌘Z / ⌘Y redo · Esc deselect.
 */
export function useEditorShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return
      const store = useEditorStore.getState()
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && key === "z") {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && key === "y") {
        event.preventDefault()
        store.redo()
        return
      }
      if (mod || event.altKey) return

      switch (key) {
        case " ":
          event.preventDefault()
          store.togglePlay()
          return
        case "arrowleft":
        case "arrowright": {
          event.preventDefault()
          const step = event.shiftKey ? store.fps : 1
          store.seek(store.frame + (key === "arrowleft" ? -step : step))
          return
        }
        case "backspace":
        case "delete":
          if (store.selectedClipId) {
            event.preventDefault()
            store.dispatch([{ type: "removeClip", clipId: store.selectedClipId }])
          }
          return
        case "s":
          if (store.selectedClipId) {
            const result = splitClipOps(store.data, store.selectedClipId, store.frame, () => crypto.randomUUID())
            if (result) store.dispatch(result.ops)
          }
          return
        case "v":
          store.setTool("select")
          return
        case "c":
          store.setTool("split")
          return
        case "escape":
          store.select(null)
          store.setTool("select")
          return
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
