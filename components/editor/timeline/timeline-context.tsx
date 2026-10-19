"use client"

import { createContext, useContext, useRef } from "react"

import { snapFrame, snapPoints, snapRange } from "@/lib/project/snap"
import { useEditorStore } from "@/stores/editor-store"

export const HEADER_W = 196
export const RULER_H = 30
export const SECTIONS_H = 34
export const TRACK_H = 40
export const TRACK_GAP = 8
/** Snap distance, in screen pixels. */
const SNAP_PX = 8

export const SECTION_COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#14b8a6", "#f59e0b", "#ec4899", "#f97316"]

/**
 * Shared geometry: the element whose left edge is frame 0 (it scrolls with the content),
 * and helpers that turn pointer positions into (snapped) frames.
 */
const TimelineContext = createContext<{ originRef: React.RefObject<HTMLDivElement | null> } | null>(null)

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const originRef = useRef<HTMLDivElement>(null)
  return <TimelineContext value={{ originRef }}>{children}</TimelineContext>
}

type SnapOptions = { excludeClipId?: string; /** Shift held: no snapping for this move. */ bypass?: boolean }

export function useTimeline() {
  const context = useContext(TimelineContext)
  if (!context) throw new Error("useTimeline must be used inside <TimelineProvider>")
  const { originRef } = context

  const pxPerFrame = () => {
    const { pxPerSecond, fps } = useEditorStore.getState()
    return pxPerSecond / fps
  }

  /** Unsnapped frame under a client x coordinate (can be negative). */
  const frameAt = (clientX: number) => {
    const left = originRef.current?.getBoundingClientRect().left ?? 0
    return Math.round((clientX - left) / pxPerFrame())
  }

  /** Snaps a frame (when snapping is on and not bypassed) and shows the guide line where it lands. */
  const snap = (frame: number, options: SnapOptions = {}) => {
    const { snap: on, data, frame: playhead, fps, setSnapLine } = useEditorStore.getState()
    if (!on || options.bypass) {
      setSnapLine(null)
      return frame
    }
    const snapped = snapFrame(frame, snapPoints(data, { playhead, excludeClipId: options.excludeClipId }), SNAP_PX / pxPerFrame(), fps)
    setSnapLine(snapped !== frame ? snapped : null)
    return snapped
  }

  /** Snaps a moving clip by whichever edge is closer to something. */
  const snapMove = (from: number, duration: number, clipId: string, bypass = false) => {
    const { snap: on, data, frame: playhead, fps, setSnapLine } = useEditorStore.getState()
    if (!on || bypass) {
      setSnapLine(null)
      return from
    }
    const points = snapPoints(data, { playhead, excludeClipId: clipId })
    const snapped = snapRange(from, duration, points, SNAP_PX / pxPerFrame(), fps)
    if (snapped === from) setSnapLine(null)
    else setSnapLine(points.includes(snapped) ? snapped : snapped + duration)
    return snapped
  }

  const clearSnapLine = () => useEditorStore.getState().setSnapLine(null)

  return { originRef, pxPerFrame, frameAt, snap, snapMove, clearSnapLine }
}

/** The lane (track id) under a client y coordinate, from the rendered lanes. */
export function laneAt(clientY: number): string | null {
  for (const lane of document.querySelectorAll<HTMLElement>("[data-lane-track-id]")) {
    const rect = lane.getBoundingClientRect()
    if (clientY >= rect.top - TRACK_GAP / 2 && clientY < rect.bottom + TRACK_GAP / 2) return lane.dataset.laneTrackId!
  }
  return null
}

/** The vertical distance between two lanes, to slide a dragged clip into its target row. */
export function laneOffset(fromTrackId: string, toTrackId: string) {
  const from = document.querySelector(`[data-lane-track-id="${fromTrackId}"]`)?.getBoundingClientRect()
  const to = document.querySelector(`[data-lane-track-id="${toTrackId}"]`)?.getBoundingClientRect()
  return from && to ? to.top - from.top : 0
}
