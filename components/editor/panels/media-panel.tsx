"use client"

import { useQuery } from "@tanstack/react-query"
import { ImagesIcon, UploadIcon } from "lucide-react"

import { PillButton } from "@/components/brand/pill-button"
import { MediaCard, UploadingCard } from "@/components/editor/panels/media-card"
import { MediaDropzone } from "@/components/editor/panels/media-dropzone"
import { useMediaUpload } from "@/components/editor/panels/use-media-upload"
import { Skeleton } from "@/components/ui/skeleton"
import { getMediaQueryFn, queryKeys } from "@/lib/api"
import { useEditorStore } from "@/stores/editor-store"

/** Media tab: upload to ImageKit (drop files anywhere on the panel, or the upload button), then drag the cards onto the timeline. */
export function MediaPanel() {
  const projectId = useEditorStore((state) => state.projectId)
  const {
    data: media,
    isPending,
    isError,
  } = useQuery({ 
    queryKey: queryKeys.media(projectId),
    queryFn: () => getMediaQueryFn(projectId),
    enabled: Boolean(projectId),
  })
  const { pending, uploadFile, cancel } = useMediaUpload(projectId)

  const hasCards = pending.length > 0 || (media?.length ?? 0) > 0
  const isEmpty = !isPending && !isError && !hasCards

  return (
    <MediaDropzone onFiles={(files) => files.forEach(uploadFile)} showUploadButton={!isEmpty}>
      {(openPicker) =>
        isPending ? (
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
          <MediaEmptyState onUpload={openPicker} />
        )
      }
    </MediaDropzone>
  )
}

export function MediaEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <ImagesIcon className="size-7 text-muted-foreground/70" />
      <p className="mt-3 text-sm font-semibold">No media yet</p>
      <p className="mt-1 max-w-[220px] text-[13px] leading-relaxed text-muted-foreground">
        Drop files here or upload them, then drag them onto the timeline.
      </p>
      <PillButton size="sm" className="mt-4" onClick={onUpload}>
        <UploadIcon />
        Upload media
      </PillButton>
    </div>
  )
}
