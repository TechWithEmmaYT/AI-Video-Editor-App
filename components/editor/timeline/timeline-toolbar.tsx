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
  Trash2Icon,
  SkipForwardIcon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { useState } from "react"
import { cn } from "cn"

import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { clearTimelineOps } from "@/lib/project/edit"
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
        <span className="mx-1 h-6 w-px bg-border" />
        <ClearTimelineButton />
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

/** Removes every clip, section and track, after a confirm. One undoable step. */
function ClearTimelineButton() {
  const clipCount = useEditorStore((state) => state.data.doc.clips.length)
  const sectionCount = useEditorStore((state) => state.data.doc.sections.length)
  const [open, setOpen] = useState(false)
  const empty = clipCount === 0 && sectionCount === 0

  function clear() {
    const { data, dispatch, select } = useEditorStore.getState()
    const ops = clearTimelineOps(data)
    if (ops && dispatch(ops)) select(null)
    setOpen(false)
  }

  const parts = [clipCount > 0 && `${clipCount} clip${clipCount === 1 ? "" : "s"}`, sectionCount > 0 && `${sectionCount} section${sectionCount === 1 ? "" : "s"}`]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={empty}
        aria-label="Clear timeline"
        title="Clear timeline"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <Trash2Icon className="size-[18px]" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-3 rounded-2xl p-3.5">
        <PopoverTitle className="text-sm font-semibold">Clear the timeline?</PopoverTitle>
        <PopoverDescription className="text-[13px] leading-relaxed text-muted-foreground">
          Removes {parts.filter(Boolean).join(" and ")}. Your uploads stay in the Media tab, and ⌘Z brings it all back.
        </PopoverDescription>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button type="button" onClick={clear} className="h-8 rounded-full bg-destructive px-3.5 text-xs font-semibold text-white">
            Clear timeline
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
