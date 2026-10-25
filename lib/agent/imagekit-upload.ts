import "server-only"

import { AgentError } from "@/lib/agent/context"
import { videoThumbnailUrl } from "@/lib/media-url"
import type { CreateMediaInput } from "@/lib/project/validation"
import type { MediaKind } from "@/types/project"

/*
 * add_media_from_url's upload: ImageKit fetches the file from the URL itself (its upload API takes
 * a URL as `file`), so our server never downloads arbitrary links. Same folder as the editor's
 * uploads: /motion/{userId}/{projectId}/.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
}

type UploadResponse = {
  fileId?: string
  name?: string
  url?: string
  filePath?: string
  thumbnailUrl?: string
  fileType?: string
  size?: number
  width?: number
  height?: number
  duration?: number
  videoCodec?: string
  audioCodec?: string
  message?: string
}

function kindOf(result: UploadResponse): MediaKind | null {
  if (result.fileType === "image") return "image"
  if (result.videoCodec) return "video"
  if (result.audioCodec) return "audio"
  return null
}

export async function uploadFromUrl(url: string, name: string, userId: string, projectId: string): Promise<CreateMediaInput> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AgentError("That isn't a valid URL.")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new AgentError("Only http(s) URLs can be added.")
  return uploadToImageKit(parsed.href, name, userId, projectId, "ImageKit couldn't fetch that file")
}

/** Uploads a file's bytes (a sound effect from the library, or one the agent made). */
export function uploadBytes(bytes: Buffer, name: string, userId: string, projectId: string): Promise<CreateMediaInput> {
  return uploadToImageKit(bytes.toString("base64"), name, userId, projectId, "ImageKit couldn't store that file")
}

/** `file` is a URL for ImageKit to fetch, or the file's bytes in base64 (both are what its upload API takes). */
async function uploadToImageKit(file: string, name: string, userId: string, projectId: string, failure: string): Promise<CreateMediaInput> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  if (!privateKey) throw new AgentError("ImageKit isn't configured on the server.")

  const form = new FormData()
  form.set("file", file)
  form.set("fileName", name)
  form.set("folder", `/motion/${userId}/${projectId}/`)
  form.set("useUniqueFileName", "true")

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
    body: form,
  })
  const result = (await response.json().catch(() => ({}))) as UploadResponse
  if (!response.ok || !result.fileId || !result.url || !result.filePath) {
    throw new AgentError(`${failure}: ${result.message ?? response.statusText}. If it was a URL, use a direct file URL (not a web page).`)
  }

  const kind = kindOf(result)
  if (!kind) throw new AgentError("That file isn't a video, image or audio file ImageKit recognises.")

  const extension = (result.name ?? name).split(".").pop()?.toLowerCase() ?? ""
  const positive = (value?: number) => (value && value > 0 ? value : null)
  return {
    kind,
    name,
    mime: MIME_BY_EXTENSION[extension] ?? `${kind}/*`,
    size: result.size ?? 0,
    imagekitFileId: result.fileId,
    filePath: result.filePath,
    url: result.url,
    thumbnailUrl: kind === "image" ? (result.thumbnailUrl ?? result.url) : kind === "video" ? videoThumbnailUrl(result.url) : null,
    width: positive(result.width),
    height: positive(result.height),
    durationSec: positive(result.duration),
    // Contact sheets are made in the browser on upload; files Claude adds don't have one.
    contactSheetUrl: null,
  }
}
