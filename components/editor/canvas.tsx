"use client"

import { Player, type PlayerRef } from "@remotion/player"
import { ScanIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "cn"

import { captionSafeBox } from "@/lib/agent/frames"
import { clipEnd } from "@/lib/project/edit"
import { Main, type MainProps } from "@/remotion/main"
import { useEditorStore, useSelectedClip } from "@/stores/editor-store"
import { useLocalMediaStore } from "@/stores/local-media-store"

/**
 * The composition, memoized for the Player: the Player re-renders its child on every frame, and
 * <Main> would rebuild all its <Sequence>s each time. Its props (the doc) only change on edits.
 */
const PlayerMain = memo(Main)

// Space around the video. The zoom control floats over the canvas, so no room is reserved for it.
const PAD = { x: 16, top: 16, bottom: 16 }
const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2]

/** The preview: Remotion Player, zoom/fit and the selection outline. Playback lives in the timeline toolbar. */
export function Canvas() {
  const doc = useEditorStore((state) => state.data.doc)
  const durationInFrames = useEditorStore((state) => state.data.durationInFrames)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const fps = useEditorStore((state) => state.fps)
  const select = useEditorStore((state) => state.select)
  const localSources = usePlaybackSources()

  const containerRef = useRef<HTMLDivElement>(null)
  const available = useElementSize(containerRef)
  const [zoom, setZoom] = useState<number | "fit">("fit")

  const fitScale = available
    ? Math.max(0.05, Math.min((available.width - PAD.x * 2) / width, (available.height - PAD.top - PAD.bottom) / height))
    : 0
  const scale = zoom === "fit" ? fitScale : zoom

  const playerRef = usePlayerSync()
  // preview: a file that won't play only warns here instead of breaking the whole preview.
  const inputProps = useMemo<MainProps>(() => ({ doc, preview: true, localSources }), [doc, localSources])

  function step(direction: 1 | -1) {
    const current = scale
    const next = direction > 0 ? ZOOM_STEPS.find((z) => z > current + 0.001) : ZOOM_STEPS.findLast((z) => z < current - 0.001)
    if (next) setZoom(next)
  }

  return (
    <section
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden rounded-[22px] border border-border bg-(--editor-canvas) bg-[radial-gradient(var(--editor-dots)_1px,transparent_1px)] bg-size-[18px_18px]"
    >
      {/* Scrolls when zoomed past fit; the zoom control stays put. */}
      {available && (
        <div
          className="absolute inset-0 grid place-items-center overflow-auto"
          style={{ padding: `${PAD.top}px ${PAD.x}px ${PAD.bottom}px` }}
          onPointerDown={(event) => event.target === event.currentTarget && select(null)}
        >
          <div className="relative" style={{ width: width * scale, height: height * scale }}>
            <Player
              ref={playerRef}
              component={PlayerMain}
              inputProps={inputProps}
              durationInFrames={Math.max(1, durationInFrames)}
              fps={fps}
              compositionWidth={width}
              compositionHeight={height}
              style={{ width: width * scale, height: height * scale, borderRadius: 14, overflow: "hidden" }}
              controls={false}
              clickToPlay={false}
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              // Play waits for the browser's audio to start (up to ~1s). This starts it on the first
              // click or key press and keeps it running while paused, so Play responds at once.
              _experimentalKeepAudioContextAlive
              // Stop on the last frame (where the last clip ends) instead of jumping back to 0:00.
              moveToBeginningWhenEnded={false}
              acknowledgeRemotionLicense
            />
            <CaptionSafeZone scale={scale} />
            <SelectionOutline scale={scale} />
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-10 flex h-8 items-center gap-0.5 rounded-full border border-border bg-card/90 px-1 shadow-md backdrop-blur">
        <RoundButton label="Zoom out" onClick={() => step(-1)}>
          <ZoomOutIcon className="size-3.5" />
        </RoundButton>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
        <RoundButton label="Zoom in" onClick={() => step(1)}>
          <ZoomInIcon className="size-3.5" />
        </RoundButton>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setZoom("fit")}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full px-2 text-xs transition-colors hover:bg-muted",
            zoom === "fit" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <ScanIcon className="size-3.5" />
          Fit
        </button>
      </div>
    </section>
  )
}

/**
 * The local copies the preview plays from, held still while it plays. A copy that becomes ready
 * mid-play would swap a clip's src: its player restarts while the old one's queued audio still
 * plays, so the opening is heard twice. The swap waits for the next pause instead.
 */
function usePlaybackSources() {
  const sources = useLocalMediaStore((state) => state.sources)
  const playing = useEditorStore((state) => state.playing)
  const [held, setHeld] = useState(sources)
  if (!playing && held !== sources) setHeld(sources)
  return playing ? held : sources
}

/** Mirrors the Player into the store: the ref (for seek/play) and its frame/playing events. */
// A callback ref (not useRef): the Player mounts only after the canvas is measured.
function usePlayerSync() {
  const [player, playerRef] = useState<PlayerRef | null>(null)
  const { setPlayer, setFrame, setPlaying } = useEditorStore.getState()

  useEffect(() => {
    if (!player) return
    setPlayer(player)
    player.seekTo(useEditorStore.getState().frame)

    const onFrame = (event: { detail: { frame: number } }) => setFrame(event.detail.frame)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("seeked", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onPause)
    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("seeked", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onPause)
      player.removeEventListener("ended", onPause)
      setPlayer(null)
    }
  }, [player, setPlayer, setFrame, setPlaying])

  return playerRef
}

/** While a caption is selected in a 9:16 video: the caption safe zone, as a dashed box. */
function CaptionSafeZone({ scale }: { scale: number }) {
  const clip = useSelectedClip()
  const format = useEditorStore((state) => state.format)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const isCaption = clip?.type === "code" && !!clip.elementId?.endsWith("-caption")
  if (!isCaption || format !== "9:16") return null

  const safe = captionSafeBox(width, height)
  return (
    <div
      className="pointer-events-none absolute rounded-[3px] border border-dashed border-white/60"
      style={{ left: safe.x * scale, top: safe.y * scale, width: safe.width * scale, height: safe.height * scale }}
    >
      <span className="absolute -top-5 left-0 text-[10px] text-white/70">Caption safe zone</span>
    </div>
  )
}

/** Outlines the selected clip while it's on screen (no canvas dragging in v1). */
function SelectionOutline({ scale }: { scale: number }) {
  const clip = useSelectedClip()
  // Whether it's on screen, not the frame itself, so playback doesn't re-render this every frame.
  const onScreen = useEditorStore((state) => !!clip && state.frame >= clip.from && state.frame < clipEnd(clip))
  if (!clip || clip.type === "audio" || !onScreen) return null

  const { x, y, width, height, rotation, scale: clipScale } = clip.transform
  return (
    <div
      className="pointer-events-none absolute rounded-[3px] outline-2 outline-(--editor-accent)"
      style={{
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        transform: `rotate(${rotation}deg) scale(${clipScale})`,
      }}
    />
  )
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
