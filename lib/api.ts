import axios, { isAxiosError } from "axios"

import { authClient } from "@/lib/auth-client"
import type { Op } from "@/lib/project/ops"
import type { SaveElementInput } from "@/lib/elements/validation"
import type { CreateMediaInput } from "@/lib/project/validation"
import type {
  ApiError,
  ApplyOpsRequest,
  ApiKeySummary,
  ApplyOpsResponse,
  ClaudeStatusResponse,
  ElementResponse,
  ElementsResponse,
  ImagekitAuthResponse,
  MediaListResponse,
  MediaResponse,
  ProjectResponse,
  ProjectsResponse,
} from "@/types/api"
import type { CreateProjectInput } from "@/types/project"

/*
 * Every client-side data function lives here, ready for TanStack Query:
 *   useQuery({ queryKey: queryKeys.projects, queryFn: getProjectsQueryFn })
 *   useMutation({ mutationFn: createProjectMutationFn })
 * App routes (/api/*) go through axios; auth goes through Better Auth's own client.
 */

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

// Surface the `{ error }` message our routes send back instead of axios's generic one.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError<ApiError>(error)) {
      return Promise.reject(new Error(error.response?.data?.error ?? error.message))
    }
    return Promise.reject(error)
  }
)

export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  media: (projectId: string) => ["projects", projectId, "media"] as const,
  elements: ["elements"] as const,
  claudeStatus: ["claude", "status"] as const,
  apiKeys: ["api-keys"] as const,
}

// ── Projects ────────────────────────────────────────────────────────────

export async function getProjectsQueryFn() {
  const { data } = await api.get<ProjectsResponse>("/projects")
  return data.projects
}

export async function getProjectQueryFn(id: string) {
  const { data } = await api.get<ProjectResponse>(`/projects/${id}`)
  return data.project
}

export async function createProjectMutationFn(input: CreateProjectInput) {
  const { data } = await api.post<ProjectResponse>("/projects", input)
  return data.project
}

/** Saves timeline ops. The editor store calls this for every edit (see stores/editor-store.ts). */
export async function applyOpsMutationFn({ projectId, ops, clientId }: { projectId: string; ops: Op[]; clientId?: string }) {
  const { data } = await api.post<ApplyOpsResponse>(`/projects/${projectId}/ops`, { ops, clientId } satisfies ApplyOpsRequest)
  return data.version
}

// ── Media ───────────────────────────────────────────────────────────────

/** One-time ImageKit upload credentials (token, expire, signature) plus the public key and folder. Fetch fresh for each upload. */
export async function getImagekitAuthQueryFn() {
  const { data } = await api.get<ImagekitAuthResponse>("/imagekit/auth")
  return data
}

/** The project's uploads, newest first. */
export async function getMediaQueryFn(projectId: string) {
  const { data } = await api.get<MediaListResponse>(`/projects/${projectId}/media`)
  return data.media
}

/** Records a file once it has finished uploading to ImageKit. */
export async function createMediaMutationFn({ projectId, ...input }: CreateMediaInput & { projectId: string }) {
  const { data } = await api.post<MediaResponse>(`/projects/${projectId}/media`, input satisfies CreateMediaInput)
  return data.media
}

// ── Elements ("Mine") ───────────────────────────────────────────────────

export async function getElementsQueryFn() {
  const { data } = await api.get<ElementsResponse>("/elements")
  return data.elements
}

/** Saves a code clip as a reusable element. Invalid code comes back as an error with its line. */
export async function createElementMutationFn(input: SaveElementInput) {
  const { data } = await api.post<ElementResponse>("/elements", input)
  return data.element
}

// ── Claude ──────────────────────────────────────────────────────────────

/** When the user's Claude Code last reached the MCP endpoint (null = never). */
export async function getClaudeStatusQueryFn() {
  const { data } = await api.get<ClaudeStatusResponse>("/claude/status")
  return data.lastSeenAt
}

// ── Auth (Better Auth client) ───────────────────────────────────────────

type BetterAuthResult<T> = { data: T; error: null } | { data: null; error: { message?: string } }

function unwrap<T>(result: BetterAuthResult<T>, fallback: string) {
  if (result.error) throw new Error(result.error.message ?? fallback)
  return result.data as T
}

export async function signInMutationFn(input: { email: string; password: string }) {
  return unwrap(await authClient.signIn.email(input), "Couldn't sign you in.")
}

export async function signUpMutationFn(input: { name: string; email: string; password: string }) {
  return unwrap(await authClient.signUp.email(input), "Couldn't create your account.")
}

export async function signOutMutationFn() {
  return unwrap(await authClient.signOut(), "Couldn't sign you out.")
}

export async function getSessionQueryFn() {
  return unwrap(await authClient.getSession(), "Couldn't load your session.")
}

/**
 * Creates an API key for Claude Code. `expiresInDays` null = never expires.
 * The full key is in the result only this once; the server keeps a hash.
 */
export async function createApiKeyMutationFn({ name, expiresInDays }: { name: string; expiresInDays: number | null }) {
  const result = await authClient.apiKey.create({ name, expiresIn: expiresInDays ? expiresInDays * 24 * 60 * 60 : null })
  return unwrap(result as BetterAuthResult<{ key: string; id: string; expiresAt: Date | string | null }>, "Couldn't create the key.")
}

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

/** The user's API keys, newest first. */
export async function listApiKeysQueryFn(): Promise<ApiKeySummary[]> {
  const data = unwrap(await authClient.apiKey.list(), "Couldn't load your keys.")
  return (data?.apiKeys ?? [])
    .map((key) => ({
      id: key.id,
      name: key.name,
      start: key.start,
      createdAt: iso(key.createdAt)!,
      lastUsedAt: iso(key.lastRequest),
      expiresAt: iso(key.expiresAt),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Revokes a key: Claude Code using it gets 401 from then on. */
export async function revokeApiKeyMutationFn(keyId: string) {
  return unwrap(await authClient.apiKey.delete({ keyId }), "Couldn't revoke the key.")
}
