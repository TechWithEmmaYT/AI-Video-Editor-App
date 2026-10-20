"use client"

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react"
import { useRef } from "react"

import {
  ColorRow,
  InspectorSection,
  NumberRow,
  SegmentedRow,
  SelectRow,
  TextRow,
} from "@/components/editor/inspector/fields"
import { CodeStyle } from "@/components/editor/inspector/code-style"
import { SourceRow } from "@/components/editor/inspector/source-row"
import { useClipEdit } from "@/components/editor/inspector/use-clip-edit"
import { findFont, FONTS, fontStack, loadFont, nearestWeight } from "@/lib/fonts"
import type { AudioClip, Clip, ImageClip, TextClip, VideoClip } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

/** The Style tab: the selected clip's own settings, by type. */
export function StylePanel({ clip }: { clip: Clip }) {
  switch (clip.type) {
    case "text":
      return <TextStyle clip={clip} />
    case "video":
      return <VideoStyle clip={clip} />
    case "image":
      return <ImageStyle clip={clip} />
    case "audio":
      return <AudioStyle clip={clip} />
    case "code":
      return <CodeStyle clip={clip} />
  }
}

function NameRow({ clip }: { clip: Clip }) {
  const edit = useClipEdit(clip.id)
  return <TextRow label="Name" value={clip.name} onCommit={(name) => edit.commit({ name })} />
}

const FIT_OPTIONS = [
  { value: "cover" as const, label: "Cover" },
  { value: "contain" as const, label: "Contain" },
  { value: "fill" as const, label: "Fill" },
]

const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
}

const FONT_ITEMS = FONTS.map((font) => ({ value: font.family, label: font.family }))

// ── Text ────────────────────────────────────────────────────────────────

function TextStyle({ clip }: { clip: TextClip }) {
  const edit = useClipEdit(clip.id)
  // The text when editing started: if the clip is still named after it, the name follows the new text.
  const textAtFocus = useRef(clip.text)
  const font = findFont(clip.fontFamily)
  const weights = font?.weights ?? [clip.fontWeight]
  const num = (key: keyof TextClip) => ({
    onPreview: (value: number) => edit.preview({ [key]: value }),
    onCommit: (value: number) => edit.commit({ [key]: value }),
  })

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Text">
        <textarea
          aria-label="Text"
          value={clip.text}
          rows={3}
          onFocus={() => (textAtFocus.current = clip.text)}
          onChange={(event) => edit.preview({ text: event.target.value })}
          onBlur={(event) => {
            const text = event.target.value
            const renamed = clip.name === textAtFocus.current && text.trim() ? { name: text.trim().slice(0, 60) } : {}
            edit.commit({ text, ...renamed })
          }}
          className="min-h-24 resize-y rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
        />
      </InspectorSection>

      <InspectorSection title="Font">
        <SelectRow
          label="Font"
          value={clip.fontFamily}
          items={FONT_ITEMS}
          // Show each name in its own face: load them all (one weight each) when the list opens.
          onOpenChange={(open) => open && FONTS.forEach((f) => loadFont(f.family, nearestWeight(f, 400)))}
          renderItem={(item) => <span style={{ fontFamily: fontStack(item.value) }}>{item.label}</span>}
          onChange={(family) => {
            const next = findFont(family)
            // Keep the weight if the new font has it, otherwise the closest one it ships.
            edit.commit({ fontFamily: family, fontWeight: next ? nearestWeight(next, clip.fontWeight) : clip.fontWeight })
          }}
        />
        <SelectRow
          label="Weight"
          value={String(clip.fontWeight)}
          items={weights.map((w) => ({ value: String(w), label: `${WEIGHT_NAMES[w] ?? w} · ${w}` }))}
          onChange={(w) => edit.commit({ fontWeight: Number(w) })}
        />
        <NumberRow label="Size" value={clip.fontSize} min={6} max={400} unit="px" fill {...num("fontSize")} />
        <ColorRow
          label="Colour"
          value={clip.color}
          onPreview={(color) => edit.preview({ color })}
          onCommit={(color) => edit.commit({ color })}
        />
      </InspectorSection>

      <InspectorSection title="Layout">
        <SegmentedRow
          label="Align"
          value={clip.align}
          options={[
            { value: "left", label: "Left", icon: AlignLeftIcon },
            { value: "center", label: "Centre", icon: AlignCenterIcon },
            { value: "right", label: "Right", icon: AlignRightIcon },
          ]}
          onChange={(align) => edit.commit({ align })}
        />
        <NumberRow label="Letter spacing" value={clip.letterSpacing} min={-50} max={100} step={0.5} decimals={1} unit="px" {...num("letterSpacing")} />
        <NumberRow label="Line height" value={clip.lineHeight} min={0.5} max={3} step={0.05} decimals={2} {...num("lineHeight")} />
      </InspectorSection>

      <InspectorSection title="Clip">
        <NameRow clip={clip} />
      </InspectorSection>
    </div>
  )
}

// ── Video ───────────────────────────────────────────────────────────────

function VideoStyle({ clip }: { clip: VideoClip }) {
  const edit = useClipEdit(clip.id)
  const fps = useEditorStore((state) => state.fps)
  // "Starts at" can go as far as leaves enough of the file to fill the clip.
  const maxStart = clip.sourceDurationInFrames ? Math.max(0, clip.sourceDurationInFrames - clip.durationInFrames) / fps : undefined
  const startsAt = (seconds: number) => ({ trimStartFrames: Math.max(0, Math.round(seconds * fps)) })

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Source">
        <SourceRow clip={clip} />
        <NameRow clip={clip} />
      </InspectorSection>

      <InspectorSection title="Video">
        <SegmentedRow label="Fit" value={clip.fit} options={FIT_OPTIONS} onChange={(fit) => edit.commit({ fit })} />
        <NumberRow
          label="Starts at"
          value={Math.round((clip.trimStartFrames / fps) * 10) / 10}
          min={0}
          max={maxStart}
          step={0.1}
          decimals={1}
          unit="s"
          onPreview={(s) => edit.preview(startsAt(s))}
          onCommit={(s) => edit.commit(startsAt(s))}
        />
        <VolumeRow clip={clip} />
      </InspectorSection>
    </div>
  )
}

// ── Image ───────────────────────────────────────────────────────────────

function ImageStyle({ clip }: { clip: ImageClip }) {
  const edit = useClipEdit(clip.id)
  const maxRadius = Math.round(Math.min(clip.transform.width, clip.transform.height) / 2)

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Source">
        <SourceRow clip={clip} />
        <NameRow clip={clip} />
      </InspectorSection>

      <InspectorSection title="Image">
        <SegmentedRow label="Fit" value={clip.fit} options={FIT_OPTIONS} onChange={(fit) => edit.commit({ fit })} />
        <NumberRow
          label="Corner radius"
          value={clip.radius}
          min={0}
          max={maxRadius}
          unit="px"
          fill
          onPreview={(radius) => edit.preview({ radius })}
          onCommit={(radius) => edit.commit({ radius })}
        />
      </InspectorSection>
    </div>
  )
}

// ── Audio ───────────────────────────────────────────────────────────────

function AudioStyle({ clip }: { clip: AudioClip }) {
  const edit = useClipEdit(clip.id)
  const fps = useEditorStore((state) => state.fps)
  const maxFade = clip.durationInFrames / fps
  const fade = (key: "fadeInFrames" | "fadeOutFrames") => ({
    onPreview: (s: number) => edit.preview({ [key]: Math.round(s * fps) }),
    onCommit: (s: number) => edit.commit({ [key]: Math.round(s * fps) }),
  })

  return (
    <div className="flex flex-col gap-5">
      <InspectorSection title="Source">
        <SourceRow clip={clip} />
        <NameRow clip={clip} />
      </InspectorSection>

      <InspectorSection title="Audio">
        <VolumeRow clip={clip} />
        <NumberRow label="Fade in" value={Math.round((clip.fadeInFrames / fps) * 10) / 10} min={0} max={maxFade} step={0.1} decimals={1} unit="s" {...fade("fadeInFrames")} />
        <NumberRow label="Fade out" value={Math.round((clip.fadeOutFrames / fps) * 10) / 10} min={0} max={maxFade} step={0.1} decimals={1} unit="s" {...fade("fadeOutFrames")} />
      </InspectorSection>
    </div>
  )
}

/** 0–200 %, stored as 0–2. */
function VolumeRow({ clip }: { clip: VideoClip | AudioClip }) {
  const edit = useClipEdit(clip.id)
  return (
    <NumberRow
      label="Volume"
      value={Math.round(clip.volume * 100)}
      min={0}
      max={200}
      unit="%"
      fill
      onPreview={(v) => edit.preview({ volume: v / 100 })}
      onCommit={(v) => edit.commit({ volume: v / 100 })}
    />
  )
}
