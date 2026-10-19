"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, ChevronLeftIcon, CropIcon, UploadIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { cn } from "cn"

import { ThemeToggle } from "@/components/nav/theme-toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { queryKeys } from "@/lib/api"
import { useEditorStore } from "@/stores/editor-store"

export function TopBar() {
  const format = useEditorStore((state) => state.format)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-t-2 border-primary px-4">
      <Link
        href="/app"
        className="flex h-10 items-center gap-1 rounded-full bg-muted pr-4 pl-3 text-sm font-semibold transition-colors hover:bg-(--pill-secondary)"
      >
        <ChevronLeftIcon className="size-4" />
        Projects
      </Link>
      <ProjectName />
      <SaveStatus />

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <span className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground">
          <CropIcon className="size-[18px]" />
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{format}</span>
        </span>
        {/* Export (Trigger.dev render) arrives in a later phase. */}
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            className="flex h-10 items-center overflow-hidden rounded-full bg-muted text-sm font-semibold opacity-60"
          >
            <span className="flex items-center gap-2 px-4">
              <UploadIcon className="size-4" />
              Export
            </span>
            <span className="grid h-full place-items-center border-l border-border px-2.5">
              <ChevronDownIcon className="size-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Export comes in a later step</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

/** Click to rename; saves on Enter or blur, Escape cancels. */
function ProjectName() {
  const name = useEditorStore((state) => state.data.name)
  const dispatch = useEditorStore((state) => state.dispatch)
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const next = draft?.trim()
    setDraft(null)
    if (next && next !== name && dispatch([{ type: "updateProject", patch: { name: next.slice(0, 80) } }])) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects })
    }
  }

  return (
    <input
      aria-label="Project name"
      value={draft ?? name}
      onFocus={(event) => {
        setDraft(name)
        event.currentTarget.select()
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          setDraft(null)
          requestAnimationFrame(() => (event.target as HTMLInputElement).blur())
        }
      }}
      maxLength={80}
      className="field-sizing-content max-w-[40vw] min-w-16 rounded-lg bg-transparent px-2 py-1 text-[17px] font-semibold outline-none hover:bg-muted/60 focus:bg-muted"
    />
  )
}

function SaveStatus() {
  const status = useEditorStore((state) => state.saveStatus)
  return (
    <span className={cn("text-xs", status === "error" ? "text-destructive" : "text-muted-foreground")}>
      {status === "saving" ? "Saving…" : status === "error" ? "Not saved" : "Saved"}
    </span>
  )
}
