"use client"

import { useRef, useState } from "react"
import { cn } from "cn"

import { CLIP_META } from "@/components/editor/clip-meta"
import { laneAt, laneOffset, useTimeline } from "@/components/editor/timeline/timeline-context"
import { videoThumbnailUrl } from "@/lib/media-url"
import { clipEnd, splitClipOps } from "@/lib/project/edit"
import type { Op } from "@/lib/project/ops"
import { isRangeFree } from "@/lib/project/placement"
import type { Clip } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

type Mode = "move" | "trim-start" | "trim-end"
type Preview = { from: number; duration: number; trackId: string; offsetY: number; valid: boolean }

const isMedia = (clip: Clip) => clip.type === "video" || clip.type === "audio"

/** Nearest clip edges on the same track, so trims can't run into neighbours. */
function neighbours(clips: Clip[], clip: Clip) {
  let prevEnd = 0
  let nextStart = Infinity
  for (const other of clips) {
    if (other.trackId !== clip.trackId || other.id === clip.id) continue
    if (clipEnd(other) <= clip.from) prevEnd = Math.max(prevEnd, clipEnd(other))
    if (other.from >= clipEnd(clip)) nextStart = Math.min(nextStart, other.from)
  }
  return { prevEnd, nextStart }
}

/** One clip block: drag to move (across tracks too), drag an edge to trim, click with the split tool to cut. */
export function ClipItem({ clip, pxPerFrame }: { clip: Clip; pxPerFrame: number }) {
  const selected = useEditorStore((state) => state.selectedClipId === clip.id)
  const tool = useEditorStore((state) => state.tool)
  const { frameAt, snap, snapMove, clearSnapLine } = useTimeline()
  const [preview, setPreview] = useState<Preview | null>(null)
  const drag = useRef<{ mode: Mode; startX: number; moved: boolean } | null>(null)
  const meta = CLIP_META[clip.type]

  function begin(mode: Mode, event: React.PointerEvent) {
    if (event.button !== 0) return
    event.stopPropagation()
    const store = useEditorStore.getState()

    if (store.tool === "split") {
      const result = splitClipOps(store.data, clip.id, frameAt(event.clientX), () => crypto.randomUUID())
      if (result) store.dispatch(result.ops, { select: clip.id })
      return
    }

    store.select(clip.id)
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    drag.current = { mode, startX: event.clientX, moved: false }
  }

  function onPointerMove(event: React.PointerEvent) {
    const current = drag.current
    if (!current) return
    // Ignore jitter: a click shouldn't become a 1-frame move.
    if (!current.moved) {
      const sameLane = (laneAt(event.clientY) ?? clip.trackId) === clip.trackId
      if (Math.abs(event.clientX - current.startX) < 3 && sameLane) return
      current.moved = true
    }

    const { data } = useEditorStore.getState()
    const delta = Math.round((event.clientX - current.startX) / pxPerFrame)
    const end = clipEnd(clip)

    if (current.mode === "move") {
      const from = Math.max(0, snapMove(Math.max(0, clip.from + delta), clip.durationInFrames, clip.id, event.shiftKey))
      const trackId = laneAt(event.clientY) ?? clip.trackId
      setPreview({
        from,
        duration: clip.durationInFrames,
        trackId,
        offsetY: laneOffset(clip.trackId, trackId),
        valid: isRangeFree(data.doc, trackId, from, clip.durationInFrames, clip.id),
      })
      return
    }

    const { prevEnd, nextStart } = neighbours(data.doc.clips, clip)
    if (current.mode === "trim-start") {
      // Media can't start before its source does.
      const earliest = isMedia(clip) && "trimStartFrames" in clip ? clip.from - clip.trimStartFrames : 0
      const from = Math.min(end - 1, Math.max(prevEnd, earliest, 0, snap(clip.from + delta, { excludeClipId: clip.id, bypass: event.shiftKey })))
      setPreview({ from, duration: end - from, trackId: clip.trackId, offsetY: 0, valid: true })
    } else {
      // Media can't run past the end of its source.
      const sourceLimit =
        (clip.type === "video" || clip.type === "audio") && clip.sourceDurationInFrames
          ? clip.from + clip.sourceDurationInFrames - clip.trimStartFrames
          : Infinity
      const newEnd = Math.max(clip.from + 1, Math.min(nextStart, sourceLimit, snap(end + delta, { excludeClipId: clip.id, bypass: event.shiftKey })))
      setPreview({ from: clip.from, duration: newEnd - clip.from, trackId: clip.trackId, offsetY: 0, valid: true })
    }
  }

  function onPointerUp() {
    const current = drag.current
    drag.current = null
    const next = preview
    setPreview(null)
    clearSnapLine()
    if (!current?.moved || !next || !next.valid) return

    const unchanged = next.from === clip.from && next.duration === clip.durationInFrames && next.trackId === clip.trackId
    if (unchanged) return

    const { data, dispatch } = useEditorStore.getState()
    const patch: Record<string, unknown> =
      current.mode === "move"
        ? { from: next.from, trackId: next.trackId }
        : { from: next.from, durationInFrames: next.duration }
    if (current.mode === "trim-start" && (clip.type === "video" || clip.type === "audio")) {
      patch.trimStartFrames = clip.trimStartFrames + (next.from - clip.from)
    }

    const ops: Op[] = [{ type: "updateClip", clipId: clip.id, patch }]
    const newEnd = next.from + next.duration
    if (newEnd > data.durationInFrames) ops.push({ type: "updateProject", patch: { durationInFrames: newEnd } })
    dispatch(ops)
  }

  const shown = preview ?? { from: clip.from, duration: clip.durationInFrames, offsetY: 0, valid: true }
  const width = shown.duration * pxPerFrame
  const handles = tool === "select" && width > 28

  return (
    <div
      data-clip-id={clip.id}
      onPointerDown={(event) => begin("move", event)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setPreview(null)
        clearSnapLine()
      }}
      className={cn(
        "absolute top-0 flex h-full touch-none items-center overflow-hidden rounded-xl text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] select-none",
        tool === "split" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
        selected && "outline-2 outline-offset-2 outline-(--editor-accent)",
        preview && "z-20 opacity-90 shadow-lg",
        preview && !shown.valid && "opacity-60 outline-2 outline-destructive"
      )}
      style={{
        left: shown.from * pxPerFrame,
        width: Math.max(4, width),
        translate: `0 ${shown.offsetY}px`,
        backgroundColor: meta.color,
        backgroundImage: `${WAVE}, linear-gradient(to bottom, rgb(255 255 255 / 0.14), transparent 70%)`,
        backgroundSize: "160px 100%, 100% 100%",
        backgroundRepeat: "repeat-x, no-repeat",
      }}
    >
      {clip.type === "video" && <Filmstrip src={clip.src} />}
      {handles && <TrimHandle side="start" onPointerDown={(event) => begin("trim-start", event)} />}
      <div
        className={cn(
          "relative flex min-w-0 flex-1 items-center gap-1.5 px-1.5 [text-shadow:0_1px_2px_rgb(0_0_0/0.4)]",
          width <= 70 && "justify-center"
        )}
      >
        {width > 24 && <meta.icon className="size-3.5 shrink-0 opacity-90" strokeWidth={2.5} />}
        {width > 70 && <span className="truncate text-[13px] font-semibold">{clip.name}</span>}
      </div>
      {handles && <TrimHandle side="end" onPointerDown={(event) => begin("trim-end", event)} />}
    </div>
  )
}

function TrimHandle({ side, onPointerDown }: { side: "start" | "end"; onPointerDown: (event: React.PointerEvent) => void }) {
  return (
    <div
      aria-hidden
      onPointerDown={onPointerDown}
      className={cn(
        "relative flex h-full w-4 shrink-0 cursor-ew-resize items-center justify-center gap-0.75 transition-colors hover:bg-white/15",
        side === "start" ? "rounded-l-xl" : "rounded-r-xl"
      )}
    >
      <span className="h-5 w-0.75 rounded-full bg-white/85" />
      <span className="h-5 w-0.75 rounded-full bg-white/85" />
    </div>
  )
}

/**
 * The video's poster frame from ImageKit, repeated along the clip. It's the same URL the media card
 * uses, so it's made once and cached: zooming and trimming never ask ImageKit for new frames.
 * While it's still being generated, the clip colour shows instead.
 */
function Filmstrip({ src }: { src: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `url("${videoThumbnailUrl(src)}")`,
        backgroundSize: "auto 100%",
        backgroundRepeat: "repeat-x",
      }}
    >
      {/* Keeps the name readable over the frames. */}
      <div className="absolute inset-0 bg-linear-to-r from-black/45 via-black/15 to-black/30" />
    </div>
  )
}

/** The soft wave across every clip block in the design, tiled along its length. */
const WAVE = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40" preserveAspectRatio="none"><path d="M0 28C20 14 40 14 60 24S100 38 120 24S150 16 160 28V40H0Z" fill="white" fill-opacity="0.13"/></svg>'
)}")`
