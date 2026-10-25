"use client"

import { CloudUploadIcon, UploadIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useDropzone, type Accept, type FileRejection } from "react-dropzone"
import { toast } from "sonner"
import { cn } from "cn"

/** The biggest file any kind may be (video); use-media-upload.ts checks the per-kind limits. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

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
    code === "file-too-large" ? "is over 100 MB" : code === "file-invalid-type" ? "isn't a supported type" : "can't be uploaded"
  const more = rejections.length > 1 ? ` (and ${rejections.length - 1} more)` : ""
  return `${first?.file.name ?? "That file"} ${reason}${more}.`
}

/**
 * Wraps the Media panel. The drop target stays hidden until a file is dragged into the window,
 * then fades in over the panel. A floating button (or `openPicker` from children) opens the file picker.
 * Only real file drags show it; media cards dragged to the timeline pass straight over.
 *
 *   <MediaDropzone onFiles={(files) => files.forEach(uploadFile)}>
 *     {(openPicker) => <MediaCards />}
 *   </MediaDropzone>
 */
export function MediaDropzone({
  onFiles,
  disabled,
  showUploadButton = true,
  children,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  /** The floating upload button; hide it when the content already has one (the empty state). */
  showUploadButton?: boolean
  children: (openPicker: () => void) => React.ReactNode
}) {
  const fileDragInWindow = useFileDragInWindow()
  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    accept: MEDIA_ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: true,
    disabled,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: onFiles,
    onDropRejected: (rejections) => toast.error(explain(rejections)),
  })
  const visible = !disabled && (fileDragInWindow || isDragActive)

  return (
    <div {...getRootProps({ className: "relative flex min-h-full flex-col outline-none" })}>
      <input {...getInputProps()} />
      {children(open)}

      {/* Drop target: shown only while a file is being dragged. */}
      <div
        aria-hidden={!visible}
        className={cn(
          "pointer-events-none absolute inset-0 z-20 transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className={cn(
            "sticky top-0 flex h-full max-h-[420px] flex-col items-center justify-center rounded-[20px] border-2 border-dashed bg-card/95 px-5 text-center backdrop-blur-sm transition-[scale,border-color,background-color] duration-200 ease-out",
            visible ? "scale-100" : "scale-95",
            isDragReject ? "border-destructive bg-destructive/8" : isDragActive ? "border-primary bg-primary/8" : "border-border"
          )}
        >
          <span
            className={cn(
              "grid size-12 place-items-center rounded-full bg-muted transition-colors",
              isDragActive && !isDragReject && "bg-primary text-white"
            )}
          >
            <CloudUploadIcon className="size-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">
            {isDragReject ? "Some of these can't be uploaded" : isDragActive ? "Drop to upload" : "Drop files here to upload"}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">Video up to 100 MB · images and audio up to 25 MB</p>
        </div>
      </div>

      {showUploadButton && (
        <div className="pointer-events-none sticky bottom-0 z-10 mt-auto flex justify-end pt-4">
          <button
            type="button"
            onClick={open}
            disabled={disabled}
            aria-label="Upload media"
            title="Upload media"
            className="pointer-events-auto grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <UploadIcon className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}

/** True while files (not media cards or text) are being dragged anywhere over the page. */
function useFileDragInWindow() {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    // dragenter/dragleave fire for every element crossed, so count depth to know when it truly left.
    let depth = 0
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onEnd = () => {
      depth = 0
      setDragging(false)
    }

    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("drop", onEnd)
    window.addEventListener("dragend", onEnd)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("drop", onEnd)
      window.removeEventListener("dragend", onEnd)
    }
  }, [])

  return dragging
}
