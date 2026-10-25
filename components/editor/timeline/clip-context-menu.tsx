"use client"

import { ContextMenu } from "@base-ui/react/context-menu"
import { CopyIcon, ScissorsIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { duplicateClipOps, splitClipOps } from "@/lib/project/edit"
import type { Clip } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"

const ITEM =
  "flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-accent [&_svg]:size-4"

/** Right-click on a clip: split at the playhead, duplicate, delete. Opening it selects the clip. */
export function ClipContextMenu({ clip, trigger }: { clip: Clip; trigger: React.ReactElement }) {
  // A yes/no, not the frame itself: subscribing to the frame re-rendered every clip's menu on every
  // frame of playback, which was the editor's biggest playback cost.
  const canSplit = useEditorStore((state) => state.frame > clip.from && state.frame < clip.from + clip.durationInFrames)

  function run(action: "split" | "duplicate" | "delete") {
    const { data, dispatch, frame } = useEditorStore.getState()
    if (action === "delete") return dispatch([{ type: "removeClip", clipId: clip.id }])
    if (action === "split") {
      const result = splitClipOps(data, clip.id, frame, () => crypto.randomUUID())
      if (result) dispatch(result.ops)
      return
    }
    const result = duplicateClipOps(data, clip.id, () => crypto.randomUUID())
    if (result) dispatch(result.ops, { select: result.newClipId })
  }

  return (
    <ContextMenu.Root onOpenChange={(open) => open && useEditorStore.getState().select(clip.id)}>
      <ContextMenu.Trigger render={trigger} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50 outline-none">
          <ContextMenu.Popup className="min-w-48 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            <ContextMenu.Item className={ITEM} disabled={!canSplit} onClick={() => run("split")}>
              <ScissorsIcon /> Split at playhead <span className="ml-auto text-xs text-muted-foreground">S</span>
            </ContextMenu.Item>
            <ContextMenu.Item className={ITEM} onClick={() => run("duplicate")}>
              <CopyIcon /> Duplicate
            </ContextMenu.Item>
            <div className="my-1 h-px bg-border" />
            <ContextMenu.Item className={cn(ITEM, "text-destructive data-highlighted:text-destructive")} onClick={() => run("delete")}>
              <Trash2Icon /> Delete <span className="ml-auto text-xs text-muted-foreground">⌫</span>
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
