"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { getProjectDocQueryFn, queryKeys } from "@/lib/api"
import type { OpsEvent } from "@/lib/realtime/bus"
import { clientId, useEditorStore } from "@/stores/editor-store"

/**
 * Live updates (see the plan, §5.3): Claude's edits (and other tabs') appear as they're saved.
 * Events arrive in version order. This tab's own echo only moves the version on; the next version
 * from someone else is applied; a gap (missed events) or ops that don't apply reload the doc.
 */
export function useProjectEvents(projectId: string) {
  const queryClient = useQueryClient()
  useEffect(() => {
    const source = new EventSource(`/api/projects/${projectId}/events`)
    let reloading = false

    async function reload() {
      if (reloading) return
      reloading = true
      try {
        useEditorStore.getState().reloadDoc(await getProjectDocQueryFn(projectId))
      } catch {
        // Offline or signed out: the next event or reconnect tries again.
      } finally {
        reloading = false
      }
    }

    source.addEventListener("hello", (message) => {
      const { version } = JSON.parse((message as MessageEvent).data) as { version: number }
      if (version > useEditorStore.getState().version) void reload()
    })

    source.addEventListener("ops", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as OpsEvent
      const store = useEditorStore.getState()
      if (event.version <= store.version) return // already have it (replayed on reconnect)
      if (event.version > store.version + 1) return void reload() // missed some
      if (event.clientId === clientId) return store.setVersion(event.version)
      if (!store.applyRemote(event.ops, event.version)) void reload()
    })

    // Claude added a file: refresh the Media tab.
    source.addEventListener("media", () => void queryClient.invalidateQueries({ queryKey: queryKeys.media(projectId) }))

    return () => source.close()
  }, [projectId, queryClient])
}
