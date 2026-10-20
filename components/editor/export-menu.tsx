"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { ChevronDownIcon, DownloadIcon, LinkIcon, UploadIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressRange,
  CircularProgressTrack,
} from "@/components/ui/circular-progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cancelExportMutationFn, getExportsQueryFn, getStreamStatusQueryFn, queryKeys, startExportMutationFn } from "@/lib/api"
import { isFinished, type ExportStatus, type RenderVideoMetadata, type VideoExport } from "@/lib/export/types"
import { sharePath } from "@/lib/export/urls"
import { formatLength } from "@/lib/project/formats"
import { timeAgo } from "@/lib/time"
import { useEditorStore } from "@/stores/editor-store"
import type { renderVideo } from "@/trigger/render-video"

/**
 * The top bar's Export (see the plan, §9): Export now (after a confirmation, so it isn't started by
 * mistake), the running export's live progress with Cancel, and past exports with Download MP4 and
 * Copy share link (the public /share page). Progress comes live from the Trigger.dev run
 * (useLiveExport), so the button keeps showing it with the menu closed.
 */
export function ExportMenu() {
  const projectId = useEditorStore((state) => state.projectId)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const durationInFrames = useEditorStore((state) => state.data.durationInFrames)
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const { data: exports = [] } = useQuery({
    queryKey: queryKeys.exports(projectId),
    queryFn: () => getExportsQueryFn(projectId),
    enabled: Boolean(projectId),
  })
  const saved = exports.find((item) => !isFinished(item.status))
  const live = useLiveExport(projectId, saved)
  // The live run is ahead of what's saved: once it has ended, stop showing it as running.
  const running = saved && !live.ended ? live.current : undefined
  // Only finished videos are listed; a failed export just shows a toast (Export now tries again).
  const past = exports.filter((item) => item.status === "done" && item.mp4Url)

  const start = useMutation({
    mutationFn: () => startExportMutationFn(projectId),
    onSuccess: (started) => {
      queryClient.setQueryData<VideoExport[]>(queryKeys.exports(projectId), (list = []) => [
        started,
        ...list.filter((item) => item.id !== started.id),
      ])
      if (started.status === "failed")
        toast.error("Export failed", {
          description: started.error ?? undefined,
        })
    },
    onError: (error) => {
      toast.error("Couldn't start the export", { description: error.message })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.exports(projectId),
      })
    },
  })
  const cancel = useMutation({
    mutationFn: cancelExportMutationFn,
    onSuccess: (cancelled) => {
      queryClient.setQueryData<VideoExport[]>(queryKeys.exports(projectId), (list = []) =>
        list.map((item) => (item.id === cancelled.id ? cancelled : item)),
      )
      toast("Export cancelled")
    },
    onError: (error) => {
      toast.error("Couldn't cancel the export", { description: error.message })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.exports(projectId),
      })
    },
  })
  const busy = Boolean(running) || start.isPending
  const summary = `MP4 · ${width}×${height} · ${formatLength(durationInFrames)}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Export"
          className="flex h-10 items-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-2 px-4">
            {running ? (
              <ProgressRing value={running.status === "rendering" ? running.progress : null} />
            ) : start.isPending ? (
              <ProgressRing value={null} />
            ) : (
              <UploadIcon className="size-4" />
            )}
            {running ? <span className="tabular-nums">{stepLabel(running)}</span> : start.isPending ? "Starting…" : "Export"}
          </span>
          <span className="grid h-full place-items-center border-l border-primary-foreground/20 px-2.5">
            <ChevronDownIcon className="size-4" />
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[22rem] p-1.5">
          <DropdownMenuItem disabled={busy} onClick={() => setConfirming(true)} className="gap-3 rounded-lg py-2 pl-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <UploadIcon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-semibold">Export now</span>
              <span className="text-xs text-muted-foreground">{summary}</span>
            </span>
          </DropdownMenuItem>

          {running && (
            <RunningExport
              item={running}
              cancelling={cancel.isPending}
              onCancel={() => cancel.mutate({ projectId, exportId: running.id })}
            />
          )}

          {past.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 pt-0.5 pb-1">Past exports</DropdownMenuLabel>
                {past.map((item) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <DropdownMenuItem render={<a href={item.mp4Url!} download />} className="min-w-0 flex-1 gap-3 rounded-lg py-1.5 pl-2">
                      <DownloadIcon className="text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[13px]">Download MP4</span>
                        <span className="text-xs text-muted-foreground">{timeAgo(item.finishedAt ?? item.createdAt)}</span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => copyShareLink(item.id)}
                      className="shrink-0 gap-1.5 self-stretch rounded-lg px-2.5 text-xs font-semibold"
                    >
                      <LinkIcon className="size-3.5" />
                      Copy share link
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary text-primary-foreground">
              <UploadIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Export this video?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary}, rendered from the timeline as it is now. It takes a few minutes; you can keep editing, and cancel it while it
              renders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false)
                start.mutate()
              }}
            >
              Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Watches the running export's Trigger.dev run live (Realtime, read-only token from the server):
 * its step and progress come from the run's metadata. When the run ends, the list is refetched
 * (the server saves the output or the error from the run) and a toast says how it went.
 */
function useLiveExport(projectId: string, saved: VideoExport | undefined) {
  const queryClient = useQueryClient()
  const toasted = useRef(new Set<string>())

  const { run } = useRealtimeRun<typeof renderVideo>(saved?.live?.runId, {
    accessToken: saved?.live?.accessToken,
    enabled: Boolean(saved?.live),
    skipColumns: ["payload", "output"],
    onComplete: async () => {
      if (!saved || toasted.current.has(saved.id)) return
      toasted.current.add(saved.id)
      const list = await queryClient.fetchQuery({
        queryKey: queryKeys.exports(projectId),
        queryFn: () => getExportsQueryFn(projectId),
        staleTime: 0,
      })
      const finished = list.find((item) => item.id === saved.id)
      if (finished?.status === "done" && finished.mp4Url) {
        const url = finished.mp4Url
        toast.success("Your video is ready", {
          action: {
            label: "Download",
            onClick: () => window.open(url, "_blank"),
          },
        })
      } else if (finished?.status === "failed") {
        toast.error("Export failed", {
          description: finished.error ?? undefined,
        })
      }
    },
  })

  if (!saved || !run || run.id !== saved.live?.runId) return { current: saved, ended: false }
  const { step, progress } = (run.metadata ?? {}) as RenderVideoMetadata
  const status: ExportStatus = step === "uploading" ? "uploading" : step === "rendering" ? "rendering" : "queued"
  return {
    current: {
      ...saved,
      status,
      progress: Math.max(saved.progress, progress ?? 0),
    },
    ended: run.isCompleted,
  }
}

/**
 * Copies the export's public page link. Also asks for its stream once, so ImageKit starts preparing
 * HLS now and it's (nearly) ready by the time someone opens the link.
 */
async function copyShareLink(exportId: string) {
  try {
    await navigator.clipboard.writeText(new URL(sharePath(exportId), window.location.origin).href)
    toast.success("Share link copied")
  } catch {
    toast.error("Couldn't copy the link")
  }
  void getStreamStatusQueryFn(exportId).catch(() => {})
}

/** The export in progress: its step, a progress bar and Cancel. */
function RunningExport({ item, cancelling, onCancel }: { item: VideoExport; cancelling: boolean; onCancel: () => void }) {
  const rendering = item.status === "rendering"
  return (
    <div className="mx-1 mt-1.5 flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold">{stepLabel(item)}</span>
        <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full rounded-full bg-primary transition-[width] duration-500", !rendering && item.status === "queued" && "w-0")}
          style={rendering || item.status === "uploading" ? { width: `${Math.round(item.progress * 100)}%` } : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        You can keep editing. The video renders with the timeline as it was when you clicked Export.
      </p>
      <button
        type="button"
        disabled={cancelling}
        onClick={onCancel}
        className="h-8 self-start rounded-full px-3 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
      >
        {cancelling ? "Cancelling…" : "Cancel export"}
      </button>
    </div>
  )
}

function stepLabel(item: VideoExport) {
  if (item.status === "queued") return "Starting…"
  if (item.status === "uploading") return "Uploading…"
  return `Rendering ${Math.round(item.progress * 100)}%`
}

/** A small ring for the button; spins (no value) while starting or uploading. */
function ProgressRing({ value }: { value: number | null }) {
  return (
    <CircularProgress value={value === null ? null : Math.round(value * 100)} size={16} thickness={2.5}>
      <CircularProgressIndicator>
        <CircularProgressTrack className="text-primary-foreground/30" />
        <CircularProgressRange className="text-primary-foreground" />
      </CircularProgressIndicator>
    </CircularProgress>
  )
}
