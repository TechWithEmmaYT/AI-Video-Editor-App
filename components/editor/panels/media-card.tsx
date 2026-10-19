"use client"

import { Image } from "@imagekit/next"
import { ImageIcon, MusicIcon, VideoIcon, XIcon } from "lucide-react"

import type { PendingUpload } from "@/components/editor/panels/use-media-upload"
import {
  CircularProgress,
  CircularProgressIndicator,
  CircularProgressRange,
  CircularProgressTrack,
  CircularProgressValueText,
} from "@/components/ui/circular-progress"
import { envConfig } from "@/lib/env"
import { setMediaDragData } from "@/lib/media-drag"
import type { Media, MediaKind } from "@/types/project"

const KIND_ICON = { video: VideoIcon, image: ImageIcon, audio: MusicIcon } satisfies Record<MediaKind, unknown>

/** An uploaded file. Drag it onto the timeline to add it as a clip. */
export function MediaCard({ media }: { media: Media }) {
  const Icon = KIND_ICON[media.kind]

  return (
    <div
      draggable
      onDragStart={(event) => setMediaDragData(event, media)}
      title={`${media.name} — drag onto the timeline`}
      className="group flex cursor-grab flex-col gap-1.5 active:cursor-grabbing"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted ring-(--editor-accent) transition-shadow group-hover:ring-2">
        {media.thumbnailUrl ? (
          <Image
            urlEndpoint={envConfig.imagekit.urlEndpoint}
            src={media.thumbnailUrl}
            alt=""
            fill
            sizes="160px"
            draggable={false}
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center bg-(--clip-audio)/15 text-(--clip-audio)">
            <Icon className="size-6" />
          </div>
        )}
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur">
          <Icon className="size-3" />
          {media.durationSec ? formatDuration(media.durationSec) : media.kind === "image" ? "Image" : null}
        </span>
      </div>
      <p className="truncate text-[13px] font-medium">{media.name}</p>
    </div>
  )
}

/** A file on its way up: its local preview, a progress ring and a cancel button. */
export function UploadingCard({ upload, onCancel }: { upload: PendingUpload; onCancel: () => void }) {
  const Icon = KIND_ICON[upload.kind]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        {upload.kind === "image" && (
          // A local blob: URL, so there's nothing for ImageKit or next/image to optimise yet.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={upload.previewUrl} alt="" className="size-full object-cover opacity-40" />
        )}
        {upload.kind === "video" && (
          <video src={upload.previewUrl} muted preload="metadata" className="size-full object-cover opacity-40" />
        )}
        {upload.kind === "audio" && (
          <div className="grid h-full place-items-center text-muted-foreground/50">
            <Icon className="size-6" />
          </div>
        )}

        <div className="absolute inset-0 grid place-items-center">
          {/* Indeterminate until bytes start moving (while it fetches credentials). */}
          <CircularProgress value={upload.progress > 0 ? upload.progress : null} size={44} thickness={4}>
            <CircularProgressIndicator>
              <CircularProgressTrack className="text-white/25" />
              <CircularProgressRange className="text-white" />
            </CircularProgressIndicator>
            <CircularProgressValueText className="text-[10px] font-semibold text-white tabular-nums" />
          </CircularProgress>
        </div>

        <button
          type="button"
          aria-label={`Cancel uploading ${upload.name}`}
          title="Cancel upload"
          onClick={onCancel}
          className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <p className="truncate text-[13px] font-medium text-muted-foreground">{upload.name}</p>
    </div>
  )
}

/** 75.4 → "1:15". */
function formatDuration(seconds: number) {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
