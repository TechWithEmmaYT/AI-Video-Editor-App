"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon, MusicIcon, RefreshCwIcon, UploadIcon, VideoIcon } from "lucide-react"
import { useRef, useState } from "react"

import { UploadingCard } from "@/components/editor/panels/media-card"
import { MEDIA_ACCEPT } from "@/components/editor/panels/media-dropzone"
import { useMediaUpload } from "@/components/editor/panels/use-media-upload"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { getMediaQueryFn, queryKeys } from "@/lib/api"
import { videoThumbnailUrl } from "@/lib/media-url"
import { replaceSourceOps } from "@/lib/project/edit"
import type { AudioClip, ImageClip, VideoClip } from "@/lib/project/schema"
import { useEditorStore } from "@/stores/editor-store"
import type { Media, MediaKind } from "@/types/project"

type MediaClip = VideoClip | ImageClip | AudioClip

const KIND_ICON = { video: VideoIcon, image: ImageIcon, audio: MusicIcon } satisfies Record<MediaKind, unknown>

/** File types the picker's upload offers, per kind (the Media panel's list, filtered). */
function acceptFor(kind: MediaKind) {
  return Object.entries(MEDIA_ACCEPT)
    .filter(([mime]) => mime.startsWith(`${kind}/`))
    .flatMap(([mime, extensions]) => [mime, ...extensions])
    .join(",")
}

/**
 * The clip's file, with Replace: pick another upload of the same kind, or upload a new one
 * (the Media panel's upload, so it also appears there). The clip keeps its place and settings.
 */
export function SourceRow({ clip }: { clip: MediaClip }) {
  const projectId = useEditorStore((state) => state.projectId)
  const fps = useEditorStore((state) => state.fps)
  const { data: media } = useQuery({
    queryKey: queryKeys.media(projectId),
    queryFn: () => getMediaQueryFn(projectId),
    enabled: Boolean(projectId),
  })
  const { pending, uploadFile, cancel } = useMediaUpload(projectId)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const current = media?.find((item) => item.id === clip.mediaId)
  const choices = (media ?? []).filter((item) => item.kind === clip.type && item.id !== clip.mediaId)
  const uploading = pending.filter((item) => item.kind === clip.type)

  function replaceWith(next: Media) {
    // Read the clip fresh: it may have changed while an upload was running.
    const latest = useEditorStore.getState().data.doc.clips.find((c) => c.id === clip.id)
    const ops = latest && replaceSourceOps(latest, next, fps)
    if (ops) useEditorStore.getState().dispatch(ops)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2 pr-3">
      <Thumbnail clip={clip} media={current} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{current?.name ?? clip.name}</p>
        <p className="truncate text-xs text-muted-foreground">{current ? describe(current) : "ImageKit"}</p>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-background/60 px-2.5 text-xs font-semibold transition-colors hover:bg-background">
          <RefreshCwIcon className="size-3.5" />
          Replace
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-3 rounded-2xl p-3">
          <PopoverTitle className="text-sm font-semibold">Replace with</PopoverTitle>

          {choices.length > 0 || uploading.length > 0 ? (
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {uploading.map((upload) => (
                <UploadingCard key={upload.id} upload={upload} onCancel={() => cancel(upload.id)} />
              ))}
              {choices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => replaceWith(item)}
                  className="group flex flex-col gap-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="relative block aspect-video overflow-hidden rounded-lg bg-muted ring-(--editor-accent) transition-shadow group-hover:ring-2">
                    <MediaPreview media={item} />
                  </span>
                  <span className="truncate text-xs font-medium">{item.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No other {clip.type} files in this project yet.</p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={acceptFor(clip.type)}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) uploadFile(file).then((uploaded) => uploaded && replaceWith(uploaded))
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <UploadIcon className="size-4" />
            Upload a new {clip.type} file
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Thumbnail({ clip, media }: { clip: MediaClip; media: Media | undefined }) {
  return (
    <span className="relative block h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
      {media ? (
        <MediaPreview media={media} />
      ) : (
        <MediaPreview media={{ kind: clip.type, url: clip.src, thumbnailUrl: clip.type === "video" ? videoThumbnailUrl(clip.src) : null }} />
      )}
    </span>
  )
}

/** The saved thumbnail (the same URL the Media panel uses, so nothing new is generated), or the kind's icon. */
function MediaPreview({ media }: { media: Pick<Media, "kind" | "url" | "thumbnailUrl"> }) {
  const [failed, setFailed] = useState(false)
  const Icon = KIND_ICON[media.kind]
  const src = media.thumbnailUrl ?? (media.kind === "image" ? media.url : null)

  if (!src || failed) {
    return (
      <span
        className="grid size-full place-items-center"
        style={{ background: `color-mix(in oklab, var(--clip-${media.kind}) 15%, transparent)`, color: `var(--clip-${media.kind})` }}
      >
        <Icon className="size-4" />
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element -- exact ImageKit URL, see media-card.tsx
  return <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} className="size-full object-cover" />
}

function describe(media: Media) {
  const parts = [media.kind === "image" ? "Image" : media.kind === "video" ? "Video" : "Audio"]
  if (media.width && media.height) parts.push(`${media.width}×${media.height}`)
  if (media.durationSec) parts.push(`${media.durationSec.toFixed(1)} s`)
  return parts.join(" · ")
}
