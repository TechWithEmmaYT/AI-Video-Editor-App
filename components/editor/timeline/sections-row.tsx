"use client"

import { ChevronRightIcon, MusicIcon, XIcon } from "lucide-react"
import { useState } from "react"

import { HEADER_W, RULER_H, SECTION_COLORS, SECTIONS_H, useTimeline } from "@/components/editor/timeline/timeline-context"
import type { Section } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

type Draft = { id: string; from: number; to: number } | null

/**
 * Named time ranges. Drag on empty space to add one, double-click a name to rename,
 * drag its edges to resize, × to delete.
 */
export function SectionsRow({ width }: { width: number }) {
  const sections = useEditorStore((state) => state.data.doc.sections)
  const pxPerSecond = useEditorStore((state) => state.pxPerSecond)
  const fps = useEditorStore((state) => state.fps)
  const dispatch = useEditorStore((state) => state.dispatch)
  const { frameAt, snap, clearSnapLine } = useTimeline()
  const [draft, setDraft] = useState<Draft>(null)
  const [start, setStart] = useState<number | null>(null)
  const ppf = pxPerSecond / fps

  return (
    <div className="sticky z-20 flex bg-card" style={{ top: RULER_H, height: SECTIONS_H }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center justify-between bg-card pr-3 pl-4"
        style={{ width: HEADER_W }}
      >
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">SECTIONS</span>
        <span className="flex items-center gap-0.5 text-muted-foreground/70">
          <MusicIcon className="size-3.5" />
          <ChevronRightIcon className="size-3.5" />
        </span>
      </div>

      <div
        className="relative touch-none"
        style={{ width }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          event.currentTarget.setPointerCapture(event.pointerId)
          const frame = Math.max(0, snap(frameAt(event.clientX), { bypass: event.shiftKey }))
          setStart(frame)
          setDraft({ id: "draft", from: frame, to: frame })
        }}
        onPointerMove={(event) => {
          if (start === null) return
          const frame = Math.max(0, snap(frameAt(event.clientX), { bypass: event.shiftKey }))
          setDraft({ id: "draft", from: Math.min(start, frame), to: Math.max(start, frame) })
        }}
        onPointerUp={() => {
          if (draft && draft.to - draft.from >= fps / 4) {
            dispatch([
              {
                type: "addSection",
                section: {
                  id: crypto.randomUUID(),
                  name: `Section ${sections.length + 1}`,
                  from: draft.from,
                  to: draft.to,
                  color: SECTION_COLORS[sections.length % SECTION_COLORS.length],
                },
              },
            ])
          }
          setStart(null)
          setDraft(null)
          clearSnapLine()
        }}
      >
        {sections.map((section) => (
          <SectionPill key={section.id} section={section} ppf={ppf} />
        ))}
        {draft && (
          <div
            className="pointer-events-none absolute top-1 bottom-1 rounded-lg border border-dashed border-muted-foreground/60 bg-muted/60"
            style={{ left: draft.from * ppf, width: (draft.to - draft.from) * ppf }}
          />
        )}
      </div>
    </div>
  )
}

function SectionPill({ section, ppf }: { section: Section; ppf: number }) {
  const dispatch = useEditorStore((state) => state.dispatch)
  const { frameAt, snap, clearSnapLine } = useTimeline()
  const [editing, setEditing] = useState(false)
  const [resize, setResize] = useState<{ from: number; to: number } | null>(null)

  const shown = resize ?? section

  function edgeHandlers(edge: "from" | "to") {
    return {
      onPointerDown: (event: React.PointerEvent) => {
        event.stopPropagation()
        ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        setResize({ from: section.from, to: section.to })
      },
      onPointerMove: (event: React.PointerEvent) => {
        if (!resize) return
        const frame = Math.max(0, snap(frameAt(event.clientX), { bypass: event.shiftKey }))
        setResize(
          edge === "from"
            ? { from: Math.min(frame, resize.to - 1), to: resize.to }
            : { from: resize.from, to: Math.max(frame, resize.from + 1) }
        )
      },
      onPointerUp: () => {
        if (resize && (resize.from !== section.from || resize.to !== section.to)) {
          dispatch([{ type: "updateSection", sectionId: section.id, patch: resize }])
        }
        setResize(null)
        clearSnapLine()
      },
    }
  }

  return (
    <div
      className="group absolute top-1 bottom-1 flex items-center overflow-hidden rounded-lg"
      style={{
        left: shown.from * ppf,
        width: Math.max(8, (shown.to - shown.from) * ppf),
        background: `color-mix(in oklab, ${section.color} 22%, transparent)`,
        color: section.color,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize touch-none" {...edgeHandlers("from")} />
      {editing ? (
        <input
          autoFocus
          defaultValue={section.name}
          maxLength={100}
          className="mx-2 min-w-0 flex-1 rounded bg-card px-1.5 text-[13px] font-semibold text-foreground outline-none"
          onBlur={(event) => {
            const name = event.target.value.trim()
            if (name && name !== section.name) {
              dispatch([{ type: "updateSection", sectionId: section.id, patch: { name } }])
            }
            setEditing(false)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
            if (event.key === "Escape") setEditing(false)
          }}
        />
      ) : (
        <span className="truncate pl-3 text-[13px] font-semibold select-none">{section.name}</span>
      )}
      <button
        type="button"
        aria-label={`Delete ${section.name}`}
        onClick={() => dispatch([{ type: "removeSection", sectionId: section.id }])}
        className="mr-1.5 ml-auto hidden size-5 shrink-0 place-items-center rounded text-current/80 group-hover:grid hover:bg-black/20"
      >
        <XIcon className="size-3.5" />
      </button>
      <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize touch-none" {...edgeHandlers("to")} />
    </div>
  )
}
