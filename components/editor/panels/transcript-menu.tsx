"use client"

import { CaptionsIcon, ClipboardPasteIcon, EllipsisIcon, FileTextIcon, SparklesIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"

import { transcriptionUnits, useTranscript } from "@/components/editor/panels/use-transcript"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useEditorStore } from "@/stores/editor-store"
import type { Media } from "@/types/project"

/** "CC" on a media card that has a transcript. */
export function TranscriptBadge({ media }: { media: Media }) {
  if (!media.transcriptSource) return null
  return (
    <span
      title={media.transcriptSource === "imagekit" ? "Transcript (ImageKit AI)" : "Transcript (added by you)"}
      className="absolute right-1.5 bottom-1.5 grid size-5 place-items-center rounded-md bg-black/60 text-white backdrop-blur"
    >
      <CaptionsIcon className="size-3" />
    </span>
  )
}

/**
 * The media card's ⋯ menu (videos and audio): add a transcript so Claude knows what's said.
 * Generate with ImageKit (videos), upload .srt/.vtt, or paste timed text; or remove it.
 */
export function TranscriptMenu({ media }: { media: Media }) {
  const projectId = useEditorStore((state) => state.projectId)
  const transcript = useTranscript(projectId, media)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pasting, setPasting] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Transcript options for ${media.name}`}
          // Don't start a drag (or select text) from the button.
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
        >
          {transcript.busy ? <Spinner className="size-3.5" /> : <EllipsisIcon className="size-3.5" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
              {media.transcriptSource ? "Replace transcript" : "Add transcript"} · lets Claude know what&apos;s said
            </DropdownMenuLabel>
            {media.kind === "video" && (
              <DropdownMenuItem disabled={transcript.busy} onClick={transcript.generate} className="items-start gap-2.5 py-2">
                <SparklesIcon className="mt-0.5" />
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">Generate with ImageKit</span>
                  <span className="text-xs text-muted-foreground">
                    AI transcript + chapters · about {transcriptionUnits(media.durationSec)} extension units
                  </span>
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled={transcript.busy} onClick={() => fileRef.current?.click()} className="gap-2.5 py-2 text-[13px]">
              <FileTextIcon />
              Upload .srt / .vtt
            </DropdownMenuItem>
            <DropdownMenuItem disabled={transcript.busy} onClick={() => setPasting(true)} className="gap-2.5 py-2 text-[13px]">
              <ClipboardPasteIcon />
              Paste transcript
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {media.transcriptSource && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={transcript.busy}
                onClick={transcript.remove}
                className="gap-2.5 py-2 text-[13px] text-destructive focus:text-destructive"
              >
                <Trash2Icon />
                Remove transcript
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) transcript.fromFile(file)
        }}
      />

      <PasteDialog open={pasting} onOpenChange={setPasting} name={media.name} onSave={transcript.fromText} />
    </>
  )
}

function PasteDialog({
  open,
  onOpenChange,
  name,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onSave: (text: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste a transcript</DialogTitle>
          <DialogDescription>For &ldquo;{name}&rdquo;. One line per moment, starting with its time. SRT and VTT work too.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              await onSave(value)
              setValue("")
              setError(null)
              onOpenChange(false)
            } catch (problem) {
              setError((problem as Error).message)
            }
          }}
        >
          <textarea
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            rows={10}
            spellCheck={false}
            placeholder={"0:00 Hi, welcome back\n0:07 So the first thing you do is…\n1:02 That's it for today"}
            className="resize-y rounded-xl bg-muted/60 px-3.5 py-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring/40"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={!value.trim()}
            className="h-10 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save transcript
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
