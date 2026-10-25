"use client"

import { MoveIcon, RotateCcwIcon } from "lucide-react"

import { InspectorSection, NumberRow } from "@/components/editor/inspector/fields"
import { useClipEdit } from "@/components/editor/inspector/use-clip-edit"
import { PanelPlaceholder } from "@/components/editor/panels/panel-placeholder"
import type { Clip, Transform } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

/** Position, size, scale, rotation and opacity: static values (no keyframes in v1). */
export function MotionPanel({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip.id)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)

  if (clip.type === "audio") {
    return <PanelPlaceholder icon={MoveIcon} title="No motion for audio" text="Audio isn't drawn on the canvas, so it has no position." />
  }

  const t = clip.transform
  const field = (key: keyof Transform, toClip: (value: number) => number = (value) => value) => ({
    onPreview: (value: number) => edit.preview({ transform: { [key]: toClip(value) } }),
    onCommit: (value: number) => edit.commit({ transform: { [key]: toClip(value) } }),
  })
  const centred = { x: Math.round((width - t.width) / 2), y: Math.round((height - t.height) / 2) }

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Position">
        <NumberRow label="X" value={t.x} unit="px" {...field("x")} />
        <NumberRow label="Y" value={t.y} unit="px" {...field("y")} />
        <button
          type="button"
          onClick={() => edit.commit({ transform: centred })}
          disabled={t.x === centred.x && t.y === centred.y}
          className="self-end rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Centre on canvas
        </button>
      </InspectorSection>

      <InspectorSection title="Size">
        <NumberRow label="Width" value={t.width} min={1} unit="px" {...field("width")} />
        <NumberRow label="Height" value={t.height} min={1} unit="px" {...field("height")} />
      </InspectorSection>

      <InspectorSection title="Transform">
        <NumberRow label="Scale" value={Math.round(t.scale * 100)} min={1} max={500} unit="%" fill {...field("scale", (v) => v / 100)} />
        <NumberRow label="Rotation" value={t.rotation} min={-360} max={360} unit="°" fill {...field("rotation")} />
        <NumberRow label="Opacity" value={Math.round(t.opacity * 100)} min={0} max={100} unit="%" fill {...field("opacity", (v) => v / 100)} />
        <button
          type="button"
          onClick={() => edit.commit({ transform: { scale: 1, rotation: 0, opacity: 1 } })}
          disabled={t.scale === 1 && t.rotation === 0 && t.opacity === 1}
          className="flex items-center gap-1.5 self-end rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <RotateCcwIcon className="size-3" />
          Reset
        </button>
      </InspectorSection>
    </div>
  )
}
