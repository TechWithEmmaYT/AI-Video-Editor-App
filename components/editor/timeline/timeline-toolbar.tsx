"use client"

import {
  ChevronDownIcon,
  LayersIcon,
  MousePointer2Icon,
  PauseIcon,
  PlayIcon,
  Redo2Icon,
  ScissorsIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { cn } from "cn"

import { Slider } from "@/components/ui/slider"
import { formatTimecode } from "@/lib/project/timecode"
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND, useEditorStore } from "@/stores/editor-store"

export function TimelineToolbar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const tool = useEditorStore((state) => state.tool)
  const snap = useEditorStore((state) => state.snap)
  const pxPerSecond = useEditorStore((state) => state.pxPerSecond)
  const canUndo = useEditorStore((state) => state.past.length > 0)
  const canRedo = useEditorStore((state) => state.future.length > 0)
  const { setTool, toggleSnap, setPxPerSecond, undo, redo } = useEditorStore.getState()

  return (
    <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-3">
      <div className="flex items-center gap-1.5">
        <ToolButton label="Select (V)" active={tool === "select"} onClick={() => setTool("select")}>
          <MousePointer2Icon className="size-[18px] fill-current" />
        </ToolButton>
        <ToolButton label="Split (C)" active={tool === "split"} onClick={() => setTool("split")}>
          <ScissorsIcon className="size-[18px]" />
        </ToolButton>
      </div>

      <Transport />

      <div className="flex items-center justify-end gap-1">
        <IconButton label="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
          <Undo2Icon className="size-[18px]" />
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>
          <Redo2Icon className="size-[18px]" />
        </IconButton>
        <span className="mx-1.5 h-6 w-px bg-border" />
        <ToolButton label={snap ? "Snapping on" : "Snapping off"} active={snap} onClick={toggleSnap}>
          <LayersIcon className="size-[18px]" />
        </ToolButton>
        <IconButton label="Zoom out" onClick={() => setPxPerSecond(pxPerSecond / 1.25)}>
          <ZoomOutIcon className="size-[18px]" />
        </IconButton>
        {/* Fixed width: the shadcn Slider stretches to fill its parent. Accent colours via its slots. */}
        <div className="w-32 px-1">
          <Slider
            aria-label="Timeline zoom"
            className="[&_[data-slot=slider-range]]:bg-(--editor-accent) [&_[data-slot=slider-thumb]]:border-(--editor-accent)"
            min={MIN_PX_PER_SECOND}
            max={MAX_PX_PER_SECOND}
            value={[pxPerSecond]}
            onValueChange={(value) => setPxPerSecond(Array.isArray(value) ? value[0] : value)}
          />
        </div>
        <IconButton label="Zoom in" onClick={() => setPxPerSecond(pxPerSecond * 1.25)}>
          <ZoomInIcon className="size-[18px]" />
        </IconButton>
        <span className="mx-1.5 h-6 w-px bg-border" />
        <IconButton label={collapsed ? "Show timeline" : "Hide timeline"} onClick={onToggleCollapsed}>
          <ChevronDownIcon className={cn("size-[18px] transition-transform", collapsed && "rotate-180")} />
        </IconButton>
      </div>
    </div>
  )
}

/** Timecode, start / play / end, total. Its own component: it re-renders every frame. */
function Transport() {
  const frame = useEditorStore((state) => state.frame)
  const playing = useEditorStore((state) => state.playing)
  const fps = useEditorStore((state) => state.fps)
  const duration = useEditorStore((state) => state.data.durationInFrames)
  const { seek, togglePlay } = useEditorStore.getState()

  return (
    <div className="flex items-center gap-2">
      <span className="w-[68px] text-right font-mono text-[15px] tabular-nums">{formatTimecode(frame, fps)}</span>
      <IconButton label="Go to start" onClick={() => seek(0)}>
        <SkipBackIcon className="size-[18px] fill-current" />
      </IconButton>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={(event) => togglePlay(event)}
        className="grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform active:scale-95"
      >
        {playing ? <PauseIcon className="size-5 fill-current" /> : <PlayIcon className="size-5 translate-x-px fill-current" />}
      </button>
      <IconButton label="Go to end" onClick={() => seek(duration - 1)}>
        <SkipForwardIcon className="size-[18px] fill-current" />
      </IconButton>
      <span className="w-[68px] font-mono text-[15px] text-muted-foreground tabular-nums">
        {formatTimecode(duration, fps)}
      </span>
    </div>
  )
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center rounded-xl transition-colors",
        active ? "bg-(--editor-accent) text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
    >
      {children}
    </button>
  )
}
