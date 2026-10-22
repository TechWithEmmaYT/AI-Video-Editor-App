/*
 * Export types shared by the app, the editor and the render task (see the plan, §9).
 * No server-only imports: the Trigger.dev task bundles this too.
 */

export type ExportStatus = "queued" | "rendering" | "uploading" | "done" | "failed" | "cancelled"

/** An export as the editor sees it. */
export type VideoExport = {
  id: string
  projectId: string
  status: ExportStatus
  /** 0–1 while rendering. */
  progress: number
  /** The MP4 on ImageKit (when done); downloads when opened. */
  mp4Url: string | null
  /** HLS stream of it (360p + 720p) for the share page. */
  hlsUrl: string | null
  error: string | null
  createdAt: string
  finishedAt: string | null
  /** While it's running: the Trigger.dev run and a read-only token to watch it live (useRealtimeRun). */
  live: { runId: string; accessToken: string } | null
}

/** A finished export as the public share page shows it. */
export type SharedExport = {
  id: string
  projectName: string
  /** The project's canvas, for the player's shape before the video loads. */
  width: number
  height: number
  mp4Url: string
  hlsUrl: string
  finishedAt: string | null
}

/** What the share page's player gets while it waits for ImageKit to prepare the HLS streams. */
export type StreamStatus = { status: "ready" } | { status: "processing" } | { status: "unavailable" }

/** What the render task needs. The doc is a snapshot taken when Export was clicked. */
export type RenderVideoPayload = {
  exportId: string
  userId: string
  projectId: string
  projectName: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  doc: unknown
}

/** The task's run metadata while it works: which step, and render progress (0–1). */
export type RenderVideoMetadata = { step?: "rendering" | "uploading"; progress?: number }

/** The task's output when it succeeds. */
export type RenderVideoOutput = { mp4Url: string; imagekitFileId: string }

export const isFinished = (status: ExportStatus) => status === "done" || status === "failed" || status === "cancelled"

/** What the render-frames task needs: a snapshot of the doc and which frames to render (Claude's render_frames tool). */
export type RenderFramesPayload = {
  userId: string
  projectId: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  doc: unknown
  frames: number[]
  /** Each frame's long side, in pixels. */
  size: number
}

/** Each frame as a base64 JPEG, or why it couldn't be rendered. */
export type RenderFramesOutput = { frames: { frame: number; jpeg: string | null; error: string | null }[] }
