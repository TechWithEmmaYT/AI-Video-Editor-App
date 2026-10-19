"use client"

import { useQuery } from "@tanstack/react-query"
import { ImagesIcon } from "lucide-react"

import { MediaCard, UploadingCard } from "@/components/editor/panels/media-card"
import { MediaDropzone } from "@/components/editor/panels/media-dropzone"
import { useMediaUpload } from "@/components/editor/panels/use-media-upload"
import { Skeleton } from "@/components/ui/skeleton"
import { getMediaQueryFn, queryKeys } from "@/lib/api"
import { useEditorStore } from "@/stores/editor-store"

/** Media tab: upload to ImageKit, then drag the cards onto the timeline. */
export function MediaPanel() {
  const projectId = useEditorStore((state) => state.projectId)
  const { data: media, isPending, isError } = useQuery({
    queryKey: queryKeys.media(projectId),
    queryFn: () => getMediaQueryFn(projectId),
    enabled: Boolean(projectId),
  })
  const { pending, uploadFile, cancel } = useMediaUpload(projectId)

  const hasCards = pending.length > 0 || (media?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-5">
      <MediaDropzone onFiles={(files) => files.forEach(uploadFile)} />

      {isPending ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="aspect-video rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center text-[13px] text-muted-foreground">Couldn&apos;t load this project&apos;s media.</p>
      ) : hasCards ? (
        <div className="grid grid-cols-2 gap-3">
          {pending.map((upload) => (
            <UploadingCard key={upload.id} upload={upload} onCancel={() => cancel(upload.id)} />
          ))}
          {media?.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      ) : (
        <MediaEmptyState />
      )}
    </div>
  )
}

export function MediaEmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <ImagesIcon className="size-7 text-muted-foreground/70" />
      <p className="mt-3 text-sm font-semibold">No media yet</p>
      <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">
        Uploads for this project show up here. Drag them onto the timeline.
      </p>
    </div>
  )
}
