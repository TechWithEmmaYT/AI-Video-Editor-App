"use client"

import { CloudUploadIcon } from "lucide-react"
import { useDropzone, type Accept, type FileRejection } from "react-dropzone"
import { toast } from "sonner"
import { cn } from "cn"

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

/** The upload types from the plan: video, images and audio. */
export const MEDIA_ACCEPT: Accept = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/svg+xml": [".svg"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "audio/mp4": [".m4a"],
  "audio/x-m4a": [".m4a"],
}

function explain(rejections: FileRejection[]) {
  const [first] = rejections
  const code = first?.errors[0]?.code
  const reason =
    code === "file-too-large" ? "is over 500 MB" : code === "file-invalid-type" ? "isn't a supported type" : "can't be uploaded"
  const more = rejections.length > 1 ? ` (and ${rejections.length - 1} more)` : ""
  return `${first?.file.name ?? "That file"} ${reason}${more}.`
}

/**
 * Click to browse or drop files. Accepted files go to onFiles; rejected ones show a toast.
 * Only real file drags activate it; media cards dragged to the timeline pass straight over.
 *
 *   <MediaDropzone onFiles={(files) => files.forEach(uploadFile)} />
 */
export function MediaDropzone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: MEDIA_ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: true,
    disabled,
    onDropAccepted: onFiles,
    onDropRejected: (rejections) => toast.error(explain(rejections)),
  })

  return (
    <div
      {...getRootProps({
        className: cn(
          "flex flex-col items-center rounded-[20px] border-2 border-dashed px-5 py-7 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isDragReject
            ? "border-destructive bg-destructive/8"
            : isDragActive
              ? "border-primary bg-primary/8"
              : "border-border hover:border-foreground/20 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-50"
        ),
      })}
    >
      <input {...getInputProps()} />
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full bg-muted transition-colors",
          isDragActive && !isDragReject && "bg-primary text-white"
        )}
      >
        <CloudUploadIcon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">
        {isDragReject ? "Some of these can't be uploaded" : isDragActive ? "Drop to upload" : "Drop files to upload"}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        or <span className="font-semibold text-primary">browse</span> · video, images, audio up to 500 MB
      </p>
    </div>
  )
}
