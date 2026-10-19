import type { Op } from "@/lib/project/ops"
import type { Media, Project } from "@/types/project"

/** Error body returned by every route in app/api (except Better Auth's own). */
export type ApiError = { error: string }

export type ProjectsResponse = { projects: Project[] }
export type ProjectResponse = { project: Project }

export type ApplyOpsRequest = { ops: Op[]; clientId?: string }
export type ApplyOpsResponse = { version: number }

export type ImagekitAuthResponse = {
  token: string
  expire: number
  signature: string
  publicKey: string
  folder: string
}
export type MediaListResponse = { media: Media[] }
export type MediaResponse = { media: Media }