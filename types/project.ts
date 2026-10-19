import type { Doc } from "@/lib/project/schema"

export type ProjectFormat = "16:9" | "9:16" | "1:1"

/** The editable timeline document. Shape and validation live in lib/project/schema.ts. */
export type ProjectDoc = Doc

/** A project as the API returns it (no timeline doc). Dates are ISO strings. */
export type Project = {
  id: string
  name: string
  format: ProjectFormat
  width: number
  height: number
  fps: number
  durationInFrames: number
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

/** A project with its timeline, as the editor loads it. */
export type ProjectWithDoc = Project & { doc: ProjectDoc; version: number }

export type CreateProjectInput = {
  name: string
  format: ProjectFormat
  /** Defaults to DEFAULT_SECONDS (15 s) when left out. */
  durationSeconds?: number
}

export type MediaKind = "video" | "image" | "audio"

/** An uploaded file (ImageKit), as the API returns it. Dates are ISO strings. */
export type Media = {
  id: string
  projectId: string
  kind: MediaKind
  name: string
  mime: string
  size: number
  imagekitFileId: string
  filePath: string
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  durationSec: number | null
  createdAt: string
}
