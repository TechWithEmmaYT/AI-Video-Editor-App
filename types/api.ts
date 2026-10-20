import type { ElementDef } from "@/lib/elements/types"
import type { VideoExport } from "@/lib/export/types"
import type { Op } from "@/lib/project/ops"
import type { Media, Project, ProjectWithDoc } from "@/types/project"

/** Error body returned by every route in app/api (except Better Auth's own). */
export type ApiError = { error: string }

export type ProjectsResponse = { projects: Project[] }
export type ProjectResponse = { project: Project }
export type ProjectDocResponse = { project: ProjectWithDoc }

export type ApplyOpsRequest = { ops: Op[]; clientId?: string }
export type ApplyOpsResponse = { version: number }

export type ImagekitAuthResponse = {
  token: string
  expire: number
  signature: string
  publicKey: string
  folder: string
}
export type ExportsResponse = { exports: VideoExport[] }
export type ExportResponse = { export: VideoExport }
export type MediaListResponse = { media: Media[] }
export type MediaResponse = { media: Media }
export type ElementsResponse = { elements: ElementDef[] }
export type ElementResponse = { element: ElementDef }

/** ISO time Claude Code last reached /api/mcp, or null if it never has. */
export type ClaudeStatusResponse = { lastSeenAt: string | null }

/** An API key as the Settings list shows it (never the key itself, only its first characters). */
export type ApiKeySummary = {
  id: string
  name: string | null
  start: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

/** Adding/removing a transcript. "processing": ImageKit is still transcribing, ask again shortly. */
export type TranscriptResponse =
  | { status: "ready"; transcriptSource: "imagekit" | "user" | null }
  | { status: "processing" }
