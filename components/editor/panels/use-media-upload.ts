"use client"

import {
  ImageKitAbortError,
  ImageKitInvalidRequestError,
  ImageKitServerError,
  ImageKitUploadNetworkError,
  upload,
  type UploadResponse,
} from "@imagekit/next"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { createMediaMutationFn, getImagekitAuthQueryFn, queryKeys } from "@/lib/api"
import { makeContactSheet } from "@/lib/contact-sheet"
import { videoThumbnailUrl } from "@/lib/media-url"
import { useMediaUploadStore, type PendingUpload } from "@/stores/media-upload-store"
import type { Media, MediaKind } from "@/types/project"

// media-card.tsx imports this type from here.
export type { PendingUpload }

// ImageKit Forever Free plan upload limits
const MAX_BYTES: Record<MediaKind, number> = {
  video: 100 * 1024 * 1024, // 100 MB
  image: 25 * 1024 * 1024, // 25 MB
  audio: 25 * 1024 * 1024, // 25 MB
}

function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("audio/")) return "audio"
  return null
}

/**
 * Uploads files straight from the browser to ImageKit, then records them on the project.
 *
 *   const { pending, uploadFile, cancel } = useMediaUpload(projectId)
 *   <MediaDropzone onFiles={(files) => files.forEach(uploadFile)} />
 *
 * `pending` holds this project's uploads in flight (for the progress cards). They live in a store,
 * so they keep running when the Media panel unmounts (switching tabs, selecting a clip).
 * Finished uploads are added to the project's media query, so they appear in the list straight away.
 */
export function useMediaUpload(projectId: string) {
  const queryClient = useQueryClient()
  // Select the whole list and filter here: a selector returning a new array re-renders forever.
  const allPending = useMediaUploadStore((state) => state.pending)
  const pending = allPending.filter((item) => item.projectId === projectId)

  /** Resolves to the saved media once it's uploaded, or null if it was rejected, failed or cancelled. */
  async function uploadFile(file: File): Promise<Media | null> {
    const kind = kindOf(file)
    if (!kind) {
      toast.error(`${file.name} isn't a video, image or audio file.`)
      return null
    }
    if (file.size > MAX_BYTES[kind]) {
      toast.error(`${file.name} is too big`, { description: `${kind} files can be up to ${MAX_BYTES[kind] / 1024 / 1024} MB.` })
      return null
    }

    const { start, setProgress, finish } = useMediaUploadStore.getState()
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)
    const controller = start({ id, projectId, name: file.name, kind, previewUrl, progress: 0 })
    // Videos: build the contact sheet (frames for Claude) from the local file while the video uploads.
    const sheet = kind === "video" ? makeContactSheet(previewUrl) : Promise.resolve(null)

    try {
      // Fresh credentials for every upload (each token works once); read the file's size and length meanwhile.
      const [auth, local] = await Promise.all([getImagekitAuthQueryFn(), readMetadata(previewUrl, kind)])
      if (controller.signal.aborted) return null

      const result = await upload({
        file,
        fileName: file.name,
        token: auth.token,
        expire: auth.expire,
        signature: auth.signature,
        publicKey: auth.publicKey,
        folder: `${auth.folder}${projectId}/`, // /motion/{userId}/{projectId}/
        abortSignal: controller.signal,
        onProgress: (event) => setProgress(id, event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      })
      if (!result.fileId || !result.filePath || !result.url) throw new Error("ImageKit didn't return the uploaded file.")
      const contactSheetUrl = await uploadContactSheet(await sheet, file.name, projectId, controller.signal)

      const media = await createMediaMutationFn({
        projectId,
        kind,
        name: file.name,
        mime: file.type,
        size: file.size,
        imagekitFileId: result.fileId,
        filePath: result.filePath,
        url: result.url,
        thumbnailUrl: thumbnailFor(kind, result),
        width: positiveOrNull(result.width ?? local.width),
        height: positiveOrNull(result.height ?? local.height),
        durationSec: positiveOrNull(result.duration ?? local.durationSec),
        contactSheetUrl,
      })
      queryClient.setQueryData<Media[]>(queryKeys.media(projectId), (list) => [media, ...(list ?? [])])
      return media
    } catch (error) {
      if (!(error instanceof ImageKitAbortError)) {
        toast.error(`Couldn't upload ${file.name}`, { description: describe(error) })
      }
      return null // failed or cancelled
    } finally {
      URL.revokeObjectURL(previewUrl)
      finish(id)
    }
  }

  function cancel(id: string) {
    useMediaUploadStore.getState().cancel(id)
  }

  return { pending, uploadFile, cancel }
} 

/**
 * Uploads a video's contact sheet next to it (same project folder) as a plain image. Null when there
 * isn't one or it fails: the video upload still succeeds without it. Cancelling still cancels.
 */
async function uploadContactSheet(blob: Blob | null, videoName: string, projectId: string, signal: AbortSignal) {
  if (!blob) return null
  try {
    // Fresh credentials: each token works for one upload.
    const auth = await getImagekitAuthQueryFn()
    const name = `${videoName.replace(/\.[^.]+$/, "")}-contact-sheet.jpg`
    const result = await upload({
      file: new File([blob], name, { type: "image/jpeg" }),
      fileName: name,
      token: auth.token,
      expire: auth.expire,
      signature: auth.signature,
      publicKey: auth.publicKey,
      folder: `${auth.folder}${projectId}/`,
      abortSignal: signal,
    })
    return result.url ?? null
  } catch (error) {
    if (error instanceof ImageKitAbortError) throw error
    return null
  }
}

/** Images use ImageKit's thumbnail; videos get a poster frame from ImageKit; audio has none. */ 
function thumbnailFor(kind: MediaKind, result: UploadResponse) {
  if (kind === "image") return result.thumbnailUrl ?? result.url ?? null
  if (kind === "video" && result.url) return videoThumbnailUrl(result.url) // same URL the timeline clip uses
  return null
}

function positiveOrNull(value: number | null | undefined) {
  return value && value > 0 ? value : null
}

function describe(error: unknown) {
  if (error instanceof ImageKitInvalidRequestError) return error.message
  if (error instanceof ImageKitUploadNetworkError) return "Check your connection and try again."
  if (error instanceof ImageKitServerError) return "ImageKit had a problem. Try again in a moment."
  return error instanceof Error ? error.message : "Something went wrong."
}

type LocalMetadata = { width: number | null; height: number | null; durationSec: number | null }

/**
 * Width, height and duration read in the browser. ImageKit's response has no duration for audio
 * (and may omit sizes), so these fill the gaps. Never fails: unknown values are null, and it
 * gives up after 3 s so a file that never reports its metadata can't block the upload.
 */
function readMetadata(url: string, kind: MediaKind): Promise<LocalMetadata> {
  const none: LocalMetadata = { width: null, height: null, durationSec: null }
  const timeout = new Promise<LocalMetadata>((resolve) => setTimeout(() => resolve(none), 3000))
  const read = new Promise<LocalMetadata>((resolve) => {
    if (kind === "image") {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, durationSec: null })
      image.onerror = () => resolve(none)
      image.src = url
      return
    }
    const element = document.createElement(kind === "video" ? "video" : "audio")
    element.preload = "metadata"
    element.onloadedmetadata = () =>
      resolve({
        width: element instanceof HTMLVideoElement ? element.videoWidth : null,
        height: element instanceof HTMLVideoElement ? element.videoHeight : null,
        durationSec: Number.isFinite(element.duration) ? element.duration : null,
      })
    element.onerror = () => resolve(none)
    element.src = url
  })
  return Promise.race([read, timeout])
}
