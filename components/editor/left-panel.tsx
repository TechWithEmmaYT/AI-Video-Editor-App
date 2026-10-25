"use client"

import {
  BotIcon,
  CopyIcon,
  ImageIcon,
  MoveIcon,
  ShapesIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react"
import { useState } from "react"

import { CLIP_META } from "@/components/editor/clip-meta"
import { MotionPanel } from "@/components/editor/inspector/motion-panel"
import { StylePanel } from "@/components/editor/inspector/style-panel"
import { PanelTabs, type PanelTab } from "@/components/editor/panel-tabs"
import { ClaudePanel } from "@/components/editor/panels/claude-panel"
import { ElementsPanel } from "@/components/editor/panels/elements-panel"
import { MediaPanel } from "@/components/editor/panels/media-panel"
import { TextPanel } from "@/components/editor/panels/text-panel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { duplicateClipOps } from "@/lib/project/edit"
import type { Clip } from "@/lib/project/schema"
import { useEditorStore, useSelectedClip } from "@/stores/editor-store"

type MainTab = "media" | "text" | "elements" | "claude"
type ClipTab = "style" | "motion"

const MAIN_TABS: PanelTab<MainTab>[] = [
  { value: "media", label: "Media", icon: ImageIcon, content: <MediaPanel /> },
  { value: "text", label: "Text", icon: TypeIcon, content: <TextPanel /> },
  { value: "elements", label: "Elements", icon: ShapesIcon, content: <ElementsPanel /> },
  { value: "claude", label: "Claude", icon: BotIcon, content: <ClaudePanel /> },
]

function clipTabs(clip: Clip): PanelTab<ClipTab>[] {
  // Keyed by clip, so switching clips starts each field fresh.
  return [
    { value: "style", label: "Style", icon: SlidersHorizontalIcon, content: <StylePanel key={clip.id} clip={clip} /> },
    { value: "motion", label: "Motion", icon: MoveIcon, content: <MotionPanel key={clip.id} clip={clip} /> },
  ]
}

/** Media | Text | Elements | Claude, or Style | Motion while a clip is selected. */
export function LeftPanel() {
  const clip = useSelectedClip()
  const [mainTab, setMainTab] = useState<MainTab>("media")
  const [clipTab, setClipTab] = useState<ClipTab>("style")

  return (
    <aside className="flex w-90 shrink-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card">
      {clip ? (
        <>
          <ClipHeader />
          <PanelTabs key="clip" tabs={clipTabs(clip)} value={clipTab} onValueChange={setClipTab} />
        </>
      ) : (
        <PanelTabs key="main" tabs={MAIN_TABS} value={mainTab} onValueChange={setMainTab} />
      )}
    </aside>
  )
}

function ClipHeader() {
  const clip = useSelectedClip()!
  const dispatch = useEditorStore((state) => state.dispatch)
  const meta = CLIP_META[clip.type]

  function duplicate() {
    const result = duplicateClipOps(useEditorStore.getState().data, clip.id, () => crypto.randomUUID())
    if (result) dispatch(result.ops, { select: result.newClipId })
  }

  return (
    <div className="flex items-start gap-3 border-b border-border px-5 pt-5 pb-4">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: meta.color }}>
        <meta.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-(family-name:--font-display) text-xl font-extrabold tracking-[-0.02em]">{clip.name}</p>
        <p className="text-[13px] text-muted-foreground">{meta.label}</p>
      </div>
      <HeaderButton label="Duplicate" onClick={duplicate}>
        <CopyIcon className="size-4" />
      </HeaderButton>
      <HeaderButton label="Delete" onClick={() => dispatch([{ type: "removeClip", clipId: clip.id }])}>
        <Trash2Icon className="size-4" />
      </HeaderButton>
    </div>
  )
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={onClick}
        className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
