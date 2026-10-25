"use client"

import { cn } from "cn"

import { CLIP_META } from "@/components/editor/clip-meta"
import { ClipItem } from "@/components/editor/timeline/clip-item"
import { HEADER_W, TRACK_GAP, TRACK_H } from "@/components/editor/timeline/timeline-context"
import type { Clip, Track } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

const MAX_CHIPS = 5

/** A track: its header (a colour chip per clip) and its lane of clips. */
export function TrackRow({
  track,
  clips,
  width,
  pxPerFrame,
  dropActive,
}: {
  track: Track
  clips: Clip[]
  width: number
  pxPerFrame: number
  dropActive: boolean
}) {
  const select = useEditorStore((state) => state.select)
  const selectedId = useEditorStore((state) => state.selectedClipId)
  const ordered = [...clips].sort((a, b) => a.from - b.from)
  const extra = ordered.length - MAX_CHIPS

  return (
    <div className="flex" style={{ height: TRACK_H, marginBottom: TRACK_GAP }}>
      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 bg-card pr-2 pl-4" style={{ width: HEADER_W }}>
        {ordered.slice(0, MAX_CHIPS).map((clip) => {
          const meta = CLIP_META[clip.type]
          return (
            <button
              key={clip.id}
              type="button"
              title={clip.name}
              aria-label={`Select ${clip.name}`}
              onClick={() => select(clip.id)}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-md text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] transition-transform hover:scale-105",
                selectedId === clip.id && "outline-2 outline-offset-1 outline-(--editor-accent)"
              )}
              style={{ background: meta.color }}
            >
              <meta.icon className="size-3" strokeWidth={2.5} />
            </button>
          )
        })}
        {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
      </div>

      <div
        data-lane-track-id={track.id}
        onPointerDown={(event) => event.target === event.currentTarget && select(null)}
        className={cn(
          "relative rounded-xl transition-colors",
          dropActive && "bg-(--editor-accent)/15 ring-1 ring-(--editor-accent)/60"
        )}
        style={{ width }}
      >
        {clips.map((clip) => (
          <ClipItem key={clip.id} clip={clip} pxPerFrame={pxPerFrame} />
        ))}
      </div>
    </div>
  )
}
