"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "cn"

import { Playhead, Ruler, SnapGuide } from "@/components/editor/timeline/ruler"
import { SectionsRow } from "@/components/editor/timeline/sections-row"
import {
  HEADER_W,
  laneAt,
  TimelineProvider,
  TRACK_GAP,
  TRACK_H,
  useTimeline,
} from "@/components/editor/timeline/timeline-context"
import { TimelineToolbar } from "@/components/editor/timeline/timeline-toolbar"
import { TrackRow } from "@/components/editor/timeline/track-row"
import { hasElementDragData, readElementDragData } from "@/lib/element-drag"
import { planElementAdd } from "@/lib/elements/place"
import { hasMediaDragData } from "@/lib/media-drag"
import { mediaDropOps, type DropTarget } from "@/lib/project/drop"
import { clipEnd } from "@/lib/project/edit"
import { planTextAdd } from "@/lib/project/text-presets"
import { hasTextPresetDragData, readTextPresetDragData } from "@/lib/text-drag"
import { useEditorStore } from "@/stores/editor-store"

export function Timeline(props: { collapsed: boolean; onToggleCollapsed: () => void }) {
  return (
    <TimelineProvider>
      <TimelineInner {...props} />
    </TimelineProvider>
  )
}

/** Extra room after the last clip, in seconds, so there's always space to drop or drag into. */
const TAIL_SECONDS = 3
/** The lane never gets narrower than this, even before the scroller has been measured. */
const MIN_LANE_W = 480

function TimelineInner({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const doc = useEditorStore((state) => state.data.doc)
  const fps = useEditorStore((state) => state.fps)
  const pxPerSecond = useEditorStore((state) => state.pxPerSecond)
  const scrollRef = useRef<HTMLDivElement>(null)
  const viewport = useScrollerWidth(scrollRef, collapsed)
  const { frameAt, snap, clearSnapLine } = useTimeline()
  const [dropHint, setDropHint] = useState<{ frame: number; target: DropTarget } | null>(null)

  const pxPerFrame = pxPerSecond / fps
  // Fill the view; only grow (and scroll) when clips reach past it. An empty timeline never scrolls.
  const clipsEnd = Math.max(0, ...doc.clips.map(clipEnd))
  const width = Math.max(MIN_LANE_W, viewport - HEADER_W, clipsEnd ? (clipsEnd / fps + TAIL_SECONDS) * pxPerSecond : 0)

  useTimelineZoom(scrollRef)
  useFitOnLoad(viewport)

  /** Where a media drag is pointing: a gap row means "new track here", a lane means that track. */
  function dropTargetAt(event: React.DragEvent): DropTarget {
    const gap = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-new-track]")
    if (gap) return { kind: "new-track", index: Number(gap.dataset.dropNewTrack) }
    const trackId = laneAt(event.clientY)
    return trackId ? { kind: "track", trackId } : { kind: "new-track", index: doc.tracks.length }
  }

  /** Media cards, Text presets and Elements can be dropped on the timeline. */
  const isClipDrag = (event: React.DragEvent) =>
    hasMediaDragData(event.dataTransfer) || hasTextPresetDragData(event.dataTransfer) || hasElementDragData(event.dataTransfer)

  function onDragOver(event: React.DragEvent) {
    if (!isClipDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    setDropHint({ frame: Math.max(0, snap(frameAt(event.clientX), { bypass: event.shiftKey })), target: dropTargetAt(event) })
  }

  function onDrop(event: React.DragEvent) {
    if (!isClipDrag(event)) return
    event.preventDefault()
    setDropHint(null)
    clearSnapLine()
    const { data, width: compWidth, height: compHeight, dispatch } = useEditorStore.getState()
    const options = {
      frame: Math.max(0, snap(frameAt(event.clientX), { bypass: event.shiftKey })),
      target: dropTargetAt(event),
      fps,
      width: compWidth,
      height: compHeight,
    }
    const presetId = readTextPresetDragData(event.dataTransfer)
    const element = readElementDragData(event.dataTransfer)
    const result = presetId
      ? planTextAdd(data, presetId, options)
      : element
        ? planElementAdd(data, element, options)
        : mediaDropOps(data, event.dataTransfer, options)
    if (result) dispatch(result.ops, { select: result.clipId })
  }

  const clipsByTrack = new Map(doc.tracks.map((track) => [track.id, doc.clips.filter((c) => c.trackId === track.id)]))
  const isTargetTrack = (trackId: string) => dropHint?.target.kind === "track" && dropHint.target.trackId === trackId
  const isTargetGap = (index: number) => dropHint?.target.kind === "new-track" && dropHint.target.index === index

  return (
    <div className="flex h-full flex-col">
      <TimelineToolbar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      {!collapsed && (
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="relative min-h-full pb-3" style={{ width: HEADER_W + width }}>
            <Ruler width={width} />
            <SectionsRow width={width} />

            <div
              className="relative"
              onDragOver={onDragOver}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropHint(null)
                  clearSnapLine()
                }
              }}
              onDrop={onDrop}
            >
              {/* Faint line every second behind the tracks. */}
              <div
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 opacity-60"
                style={{
                  left: HEADER_W,
                  width,
                  backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${pxPerSecond}px)`,
                }}
              />
              <GapRow index={0} width={width} active={isTargetGap(0)} thin />
              {doc.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  clips={clipsByTrack.get(track.id) ?? []}
                  width={width}
                  pxPerFrame={pxPerFrame}
                  dropActive={isTargetTrack(track.id)}
                />
              ))}
              <GapRow index={doc.tracks.length} width={width} active={isTargetGap(doc.tracks.length)} empty={doc.tracks.length === 0} />

              {dropHint && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-(--editor-accent)"
                  style={{ left: HEADER_W + dropHint.frame * pxPerFrame }}
                />
              )}
            </div>

            <SnapGuide />
            <Playhead scrollRef={scrollRef} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Drop zones for new tracks: a thin one above the first track and one below the last.
 * With no tracks yet, the bottom one is the big "drop media here" target.
 */
function GapRow({
  index,
  width,
  active,
  thin,
  empty,
}: {
  index: number
  width: number
  active: boolean
  thin?: boolean
  empty?: boolean
}) {
  return (
    <div className="flex" style={{ height: thin ? TRACK_GAP : TRACK_H, marginBottom: thin ? 0 : TRACK_GAP }}>
      <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: HEADER_W }} />
      <div
        data-drop-new-track={index}
        className={cn(
          "relative flex items-center rounded-xl text-[13px] text-muted-foreground transition-colors",
          !thin && "border border-dashed border-border bg-card px-4",
          empty && "h-full",
          active && (thin ? "bg-(--editor-accent)" : "border-(--editor-accent) bg-(--editor-accent)/10 text-foreground")
        )}
        style={{ width, height: thin ? 3 : undefined, marginTop: thin ? TRACK_GAP / 2 : 0 }}
      >
        {!thin && (empty ? "Drag media, text or elements here to start" : "Drop here for a new track")}
      </div>
    </div>
  )
}

/** Once the timeline is measured, zoom out (never in) so every clip fits without a scrollbar. */
function useFitOnLoad(viewport: number) {
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current || viewport <= 0) return
    fitted.current = true
    const { data, fps, pxPerSecond, setPxPerSecond } = useEditorStore.getState()
    const end = Math.max(0, ...data.doc.clips.map(clipEnd))
    if (!end) return
    const fit = Math.floor((viewport - HEADER_W) / (end / fps + TAIL_SECONDS))
    if (fit < pxPerSecond) setPxPerSecond(fit)
  }, [viewport])
}

/** The scroller's visible width. Measured before paint, so the ruler never shows up collapsed. */
function useScrollerWidth(ref: React.RefObject<HTMLDivElement | null>, collapsed: boolean) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, collapsed])
  return width
}

/**
 * Ctrl/⌘ + wheel zooms smoothly (needs a non-passive listener to stop the browser zooming the page).
 * Horizontal scroll gestures are left alone. Whatever changes the zoom, the playhead stays put on screen.
 */
function useTimelineZoom(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const capped = Math.sign(delta) * Math.min(Math.abs(delta), 30)
      const { pxPerSecond, setPxPerSecond } = useEditorStore.getState()
      setPxPerSecond(pxPerSecond * Math.exp(-capped / 300))
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  })

  // Keep the playhead anchored: shift the scroll by however far the zoom moved it.
  useEffect(
    () =>
      useEditorStore.subscribe((state, previous) => {
        const element = ref.current
        if (!element || state.pxPerSecond === previous.pxPerSecond) return
        const seconds = state.frame / state.fps
        const target = Math.max(0, element.scrollLeft + seconds * (state.pxPerSecond - previous.pxPerSecond))
        // After React has resized the content, or a zoom-in would be clamped to the old width.
        requestAnimationFrame(() => (element.scrollLeft = target))
      }),
    [ref]
  )
}
