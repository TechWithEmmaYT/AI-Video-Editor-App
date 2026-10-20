"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { cn } from "cn"

import { Canvas } from "@/components/editor/canvas"
import { LeftPanel } from "@/components/editor/left-panel"
import { Timeline } from "@/components/editor/timeline/timeline"
import { TopBar } from "@/components/editor/top-bar"
import { useEditorShortcuts } from "@/components/editor/use-editor-shortcuts"
import { useProjectEvents } from "@/components/editor/use-project-events"
import { saveEditorStateMutationFn } from "@/lib/api"
import { useEditorStore } from "@/stores/editor-store"
import type { ProjectWithDoc } from "@/types/project"

const TIMELINE_DEFAULT = 280
const TIMELINE_MIN = 170
const TOOLBAR_H = 57
const STORAGE_KEY = "motion.timelineHeight"

/** The full-screen editor. Mount with key={project.id} so switching projects starts fresh. */
export function Editor({ project }: { project: ProjectWithDoc }) {
  // Load the project into the store before any child subscribes to it.
  useState(() => useEditorStore.getState().init(project))
  // Hot reload in dev can recreate the store empty; put the project back when that happens.
  useLayoutEffect(() => {
    if (useEditorStore.getState().projectId !== project.id) useEditorStore.getState().init(project)
  })
  useEditorShortcuts()
  useWarnBeforeLeavingUnsaved()
  useReportEditorState(project.id)
  useProjectEvents(project.id)
  const timeline = useResizableTimeline()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-3 px-3">
        <LeftPanel />
        <Canvas />
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline"
        onPointerDown={timeline.startResize}
        onPointerMove={timeline.resize}
        onPointerUp={timeline.endResize}
        onDoubleClick={timeline.reset}
        className={cn(
          "group flex h-3 shrink-0 touch-none items-center justify-center",
          timeline.collapsed ? "pointer-events-none" : "cursor-row-resize"
        )}
      >
        <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/60" />
      </div>

      <section
        className="mx-3 mb-3 shrink-0 overflow-hidden rounded-[22px] border border-border bg-card"
        style={{ height: timeline.collapsed ? TOOLBAR_H : timeline.height }}
      >
        <Timeline collapsed={timeline.collapsed} onToggleCollapsed={timeline.toggleCollapsed} />
      </section>
    </div>
  )
}

/**
 * Tells the server what's open (on load, and 300 ms after the selection settles), so Claude can
 * resolve "this" to this project and the selected clip.
 */
function useReportEditorState(projectId: string) {
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveEditorStateMutationFn({ projectId, selectedClipId }).catch(() => {
        // Only affects what Claude takes "this" to mean; the next selection change tries again.
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [projectId, selectedClipId])
}

/** Edits save in the background; ask before closing the tab while one is still on its way. */
function useWarnBeforeLeavingUnsaved() {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (useEditorStore.getState().saveStatus === "saving") event.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])
}

/** Drag the bar above the timeline to resize it; double-click resets. The height is remembered per browser. */
function useResizableTimeline() {
  // The saved height comes from localStorage; the server (and first paint) use the default.
  const saved = useSyncExternalStore(subscribeToSavedHeight, readSavedHeight, () => null)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const drag = useRef<{ startY: number; startHeight: number } | null>(null)
  const height = dragHeight ?? saved ?? TIMELINE_DEFAULT

  const clamp = (value: number) => Math.round(Math.min(window.innerHeight * 0.7, Math.max(TIMELINE_MIN, value)))

  return {
    height,
    collapsed,
    toggleCollapsed: () => setCollapsed((value) => !value),
    startResize: (event: React.PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { startY: event.clientY, startHeight: height }
    },
    resize: (event: React.PointerEvent) => {
      if (!drag.current) return
      setDragHeight(clamp(drag.current.startHeight - (event.clientY - drag.current.startY)))
    },
    endResize: () => {
      if (drag.current && dragHeight !== null) saveHeight(dragHeight)
      drag.current = null
      setDragHeight(null)
    },
    reset: () => saveHeight(TIMELINE_DEFAULT),
  }
}

const HEIGHT_EVENT = "motion:timeline-height"

function readSavedHeight() {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return saved >= TIMELINE_MIN ? saved : null
  } catch {
    return null // storage unavailable (private mode): use the default
  }
}

function saveHeight(value: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {}
  window.dispatchEvent(new Event(HEIGHT_EVENT))
}

function subscribeToSavedHeight(onChange: () => void) {
  window.addEventListener(HEIGHT_EVENT, onChange)
  return () => window.removeEventListener(HEIGHT_EVENT, onChange)
}
