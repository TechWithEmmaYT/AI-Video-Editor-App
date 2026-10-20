"use client"

import { useEffect, useRef } from "react"

import { HEADER_W, RULER_H, useTimeline } from "@/components/editor/timeline/timeline-context"
import { formatRulerLabel, formatTimecode } from "@/lib/project/timecode"
import { useEditorStore } from "@/stores/editor-store"

/** Seconds between labels, so they never crowd. */
function labelStep(pxPerSecond: number) {
  for (const step of [1, 2, 5, 10, 15, 30, 60]) if (step * pxPerSecond >= 64) return step
  return 120
}

/**
 * Pointer scrubbing shared by the ruler and the playhead knob. A press on the ruler jumps
 * straight to the spot (no snapping, so it never lurches); dragging snaps to clip edges
 * unless Shift is held.
 */
function useScrub() {
  const { frameAt, snap, clearSnapLine } = useTimeline()
  const active = useRef(false)

  const seekTo = (clientX: number, snapIt: boolean) => {
    const { seek } = useEditorStore.getState()
    const frame = frameAt(clientX)
    seek(snapIt ? snap(frame) : frame)
  }

  return {
    onPointerDown: (event: React.PointerEvent, { snapOnPress }: { snapOnPress: boolean }) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      active.current = true
      seekTo(event.clientX, snapOnPress && !event.shiftKey)
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (active.current) seekTo(event.clientX, !event.shiftKey)
    },
    onPointerUp: () => {
      active.current = false
      clearSnapLine()
    },
  }
}

/** Time ruler. Its lane's left edge is frame 0 (the timeline origin). Click or drag to scrub. */
export function Ruler({ width }: { width: number }) {
  const { originRef } = useTimeline()
  const pxPerSecond = useEditorStore((state) => state.pxPerSecond)
  const scrub = useScrub()

  const step = labelStep(pxPerSecond)
  // Only labels that start inside the lane; the lane clips the rest so they can't widen the scroll area.
  const labels = Array.from({ length: Math.floor(width / pxPerSecond / step) + 1 }, (_, i) => i * step)
  const minor = (step * pxPerSecond) / (step === 1 ? 4 : 5)

  return (
    <div className="sticky top-0 z-30 flex bg-card" style={{ height: RULER_H }}>
      <div className="sticky left-0 z-10 shrink-0 bg-card" style={{ width: HEADER_W }} />
      <div
        ref={originRef}
        className="relative cursor-col-resize touch-none overflow-hidden border-b border-border select-none"
        style={{
          width,
          backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px ${minor}px)`,
          backgroundSize: "100% 6px",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
        }}
        onPointerDown={(event) => scrub.onPointerDown(event, { snapOnPress: false })}
        onPointerMove={scrub.onPointerMove}
        onPointerUp={scrub.onPointerUp}
      >
        {labels.map((second) => (
          <span
            key={second}
            className="pointer-events-none absolute top-1 font-mono text-[11px] text-muted-foreground tabular-nums"
            style={{ left: second * pxPerSecond }}
          >
            <span className="absolute top-4 left-0 h-2.5 w-px bg-muted-foreground/50" />
            {/* Nudged right of its tick so the playhead knob never covers 0:00. */}
            <span className="ml-2">{formatRulerLabel(second)}</span>
          </span>
        ))}
      </div>
      {/* In the ruler (pinned to the top), so it stays in view when the tracks scroll vertically. */}
      <PlayheadKnob />
    </div>
  )
}

/** Keeps an element at the playhead's x (via the DOM, so playback doesn't re-render React every frame). */
function usePlayheadPosition(ref: React.RefObject<HTMLElement | null>, onPlace?: (x: number) => void) {
  const onPlaceRef = useRef(onPlace)
  useEffect(() => {
    onPlaceRef.current = onPlace
  })
  useEffect(() => {
    function place() {
      const { frame, pxPerSecond, fps } = useEditorStore.getState()
      const x = HEADER_W + (frame * pxPerSecond) / fps
      if (ref.current) ref.current.style.left = `${x}px`
      onPlaceRef.current?.(x)
    }
    place()
    return useEditorStore.subscribe(place)
  }, [ref])
}

/** The playhead's handle in the ruler: drag (snaps; Shift to skip) or focus it and use ←/→. */
function PlayheadKnob() {
  const knobRef = useRef<HTMLDivElement>(null)
  const scrub = useScrub()
  usePlayheadPosition(knobRef, () => {
    const knob = knobRef.current
    if (!knob) return
    const { frame, fps, data } = useEditorStore.getState()
    knob.setAttribute("aria-valuenow", String(frame))
    knob.setAttribute("aria-valuetext", formatTimecode(frame, fps))
    knob.setAttribute("aria-valuemax", String(data.durationInFrames - 1))
  })

  return (
    <div
      ref={knobRef}
      role="slider"
      tabIndex={0}
      aria-label="Playhead"
      aria-valuemin={0}
      // Kept current by usePlayheadPosition; this is the value at render time.
      aria-valuenow={useEditorStore.getState().frame}
      className="absolute z-40 grid h-6 w-4 -translate-x-1/2 cursor-ew-resize touch-none place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-(--editor-accent)/50"
      style={{ top: RULER_H - 26 }}
      onPointerDown={(event) => scrub.onPointerDown(event, { snapOnPress: true })}
      onPointerMove={scrub.onPointerMove}
      onPointerUp={scrub.onPointerUp}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        const { frame, fps, seek } = useEditorStore.getState()
        const step = event.shiftKey ? fps : 1
        seek(frame + (event.key === "ArrowRight" ? step : -step))
      }}
    >
      <span className="h-5 w-3 rounded-full border-2 border-card bg-(--editor-accent) shadow" />
    </div>
  )
}

/**
 * The playhead line over every track. Drag it (the `<||>` cursor) to scrub, like the knob in the
 * ruler. While playing it recentres the view when it runs off screen.
 */
export function Playhead({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const lineRef = useRef<HTMLDivElement>(null)
  const scrub = useScrub()
  usePlayheadPosition(lineRef, (x) => {
    const { playing } = useEditorStore.getState()
    const scroller = scrollRef.current
    if (!playing || !scroller) return
    const visibleLeft = scroller.scrollLeft + HEADER_W
    const visibleRight = scroller.scrollLeft + scroller.clientWidth
    if (x < visibleLeft || x > visibleRight - 24) {
      scroller.scrollLeft = Math.max(0, x - HEADER_W - (scroller.clientWidth - HEADER_W) / 2)
    }
  })

  return (
    <div ref={lineRef} className="pointer-events-none absolute top-0 bottom-0 z-40 w-0">
      <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-(--editor-accent)" />
      {/* A slightly wider, invisible strip so the line is easy to grab. */}
      <div
        aria-hidden
        className="pointer-events-auto absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize touch-none"
        onPointerDown={(event) => scrub.onPointerDown(event, { snapOnPress: false })}
        onPointerMove={scrub.onPointerMove}
        onPointerUp={scrub.onPointerUp}
      />
    </div>
  )
}

/** Faint guide at the point a drag snapped to. */
export function SnapGuide() {
  const snapLine = useEditorStore((state) => state.snapLine)
  const pxPerSecond = useEditorStore((state) => state.pxPerSecond)
  const fps = useEditorStore((state) => state.fps)
  if (snapLine === null) return null
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 -translate-x-px bg-(--editor-accent)/45"
      style={{ left: HEADER_W + (snapLine * pxPerSecond) / fps }}
    />
  )
}
