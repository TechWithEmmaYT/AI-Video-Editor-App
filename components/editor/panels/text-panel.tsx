"use client"

import { PlusIcon } from "lucide-react"
import { useEffect } from "react"

import { fontStack, loadFont } from "@/lib/fonts"
import { planTextAdd, TEXT_PRESETS, type TextPreset } from "@/lib/project/text-presets"
import { setTextPresetDragData } from "@/lib/text-drag"
import { useEditorStore } from "@/stores/editor-store"

/** How big each preset's sample is drawn in the panel (px), keeping their relative sizes. */
const CARD_SIZE: Record<TextPreset["id"], number> = { title: 30, subtitle: 19, body: 14, caption: 15, label: 12, quote: 26 }

/** Text tab: click a preset to add it at the playhead, or drag it onto the timeline. */
export function TextPanel() {
  // Each card is drawn in its own font.
  useEffect(() => {
    TEXT_PRESETS.forEach((preset) => loadFont(preset.fontFamily, preset.fontWeight))
  }, [])

  function add(preset: TextPreset) {
    const { data, frame, fps, width, height, dispatch } = useEditorStore.getState()
    const result = planTextAdd(data, preset.id, { frame, target: null, fps, width, height })
    if (result) dispatch(result.ops, { select: result.clipId })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="px-1 pb-1 text-[13px] text-muted-foreground">Click to add at the playhead, or drag onto the timeline.</p>
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          draggable
          onDragStart={(event) => setTextPresetDragData(event, preset.id)}
          onClick={() => add(preset)}
          className="group relative flex min-h-16 cursor-grab flex-col justify-center gap-1 overflow-hidden rounded-2xl bg-muted/60 px-4 py-3.5 text-left ring-(--editor-accent) transition-[box-shadow,background-color] hover:bg-muted hover:ring-2 active:cursor-grabbing"
        >
          <span
            className="block truncate pr-8"
            style={{
              fontFamily: fontStack(preset.fontFamily),
              fontWeight: preset.fontWeight,
              fontSize: CARD_SIZE[preset.id],
              lineHeight: 1.15,
              letterSpacing: `${preset.tracking}em`,
              color: preset.color === "#ffffff" ? undefined : preset.color,
            }}
          >
            {preset.id === "body" ? "Body text for explaining an idea" : preset.text}
          </span>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{preset.name}</span>
          <span className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-background/70 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <PlusIcon className="size-4" />
          </span>
        </button>
      ))}
    </div>
  )
}
