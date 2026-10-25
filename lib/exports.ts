import "server-only"

import { auth, runs, tasks } from "@trigger.dev/sdk"
import { and, desc, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { project, videoExport } from "@/db/schema"
import type { ExportStatus, RenderVideoMetadata, RenderVideoOutput, SharedExport, StreamStatus, VideoExport } from "@/lib/export/types"
import { exportHlsUrl } from "@/lib/export/urls"
import { getProjectWithDoc } from "@/lib/projects"
import { projectChannel, publish } from "@/lib/realtime/bus"
import type { renderVideo } from "@/trigger/render-video"

/*
 * Exports (see the plan, §9). The Trigger.dev run is the source of truth while an export runs:
 * the editor watches it live (useRealtimeRun with the read-only token from `live`), and whenever
 * the app reads exports it saves what the run has reached (done with its output, or failed with
 * its error). Every query is scoped to the owner.
 */

/** How many past exports the editor lists. */
const HISTORY = 10
const ACTIVE: ExportStatus[] = ["queued", "rendering", "uploading"]
/** Run statuses that mean it ended without a video (CANCELED is handled on its own: not an error). */
const FAILED_RUN = new Set(["FAILED", "CRASHED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT"])

type Row = typeof videoExport.$inferSelect

/** A token that can only read this one run, for the editor's live progress. */
async function liveToken(runId: string) {
  return auth.createPublicToken({ scopes: { read: { runs: [runId] } }, expirationTime: "1h" })
}

async function toVideoExport(row: Row): Promise<VideoExport> {
  const running = ACTIVE.includes(row.status) && row.triggerRunId
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    progress: row.progress,
    mp4Url: row.mp4Url,
    hlsUrl: row.mp4Url ? exportHlsUrl(row.mp4Url) : null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    live: running ? { runId: row.triggerRunId!, accessToken: await liveToken(row.triggerRunId!) } : null,
  }
}

/** Saves what an unfinished export's run has reached. Returns the row as it is now. */
async function syncFromRun(row: Row): Promise<Row> {
  if (!ACTIVE.includes(row.status) || !row.triggerRunId) return row

  let run
  try {
    run = await runs.retrieve<typeof renderVideo>(row.triggerRunId)
  } catch (error) {
    console.error("Couldn't read the render's run", error)
    return row // Trigger.dev unreachable: try again on the next read
  }

  let patch: Partial<Row> | null = null
  if (run.status === "COMPLETED" && run.output) {
    const output = run.output as RenderVideoOutput
    patch = { status: "done", progress: 1, mp4Url: output.mp4Url, imagekitFileId: output.imagekitFileId, finishedAt: new Date() }
  } else if (run.status === "CANCELED") {
    patch = { status: "cancelled", finishedAt: new Date() }
  } else if (FAILED_RUN.has(run.status) || (run.status === "COMPLETED" && !run.output)) {
    // The technical error stays in the server log (and the Trigger.dev dashboard); people see a plain message.
    console.error(`Export ${row.id} failed (${run.status})`, run.error?.message)
    patch = { status: "failed", error: friendlyError(run.status, run.error?.message), finishedAt: new Date() }
  } else {
    const { step, progress } = (run.metadata ?? {}) as RenderVideoMetadata
    const status: ExportStatus = step === "uploading" ? "uploading" : step === "rendering" ? "rendering" : "queued"
    if (status !== row.status || (progress ?? 0) > row.progress) patch = { status, progress: Math.max(row.progress, progress ?? 0) }
  }
  if (!patch) return row

  const [saved] = await db.update(videoExport).set(patch).where(eq(videoExport.id, row.id)).returning()
  await publish(projectChannel(row.projectId), { type: "export", export: await toVideoExport(saved) })
  return saved
}

/** What the editor says when an export fails: plain words, never the raw error. */
function friendlyError(status: string, message = "") {
  if (status === "TIMED_OUT") return "Your video took too long to export. Try again, or make it shorter."
  if (status === "EXPIRED") return "The export couldn't start. Please try again in a moment."
  if (/timeout|timed out/i.test(message)) return "A video, image or font took too long to load. Check your media and try again."
  if (/imagekit|upload/i.test(message)) return "Your video rendered but couldn't be saved. Please try again."
  return "Something went wrong while exporting. Please try again."
}

export async function listExports(userId: string, projectId: string) {
  const rows = await db
    .select()
    .from(videoExport)
    .where(and(eq(videoExport.projectId, projectId), eq(videoExport.userId, userId)))
    .orderBy(desc(videoExport.createdAt))
    .limit(HISTORY)
  const synced = await Promise.all(rows.map(syncFromRun))
  return Promise.all(synced.map(toVideoExport))
}

export type StartExportResult =
  | { status: "started"; export: VideoExport }
  | { status: "busy"; export: VideoExport }
  | { status: "not-found" }

/**
 * Starts an export of the project as it is now: saves a queued export, then triggers the
 * render-video task with a snapshot of the doc. One export per project at a time.
 */
export async function startExport(userId: string, projectId: string): Promise<StartExportResult> {
  const project = await getProjectWithDoc(userId, projectId)
  if (!project) return { status: "not-found" }

  const active = await db
    .select()
    .from(videoExport)
    .where(and(eq(videoExport.projectId, projectId), inArray(videoExport.status, ACTIVE)))
  for (const row of active) {
    const now = await syncFromRun(row)
    if (ACTIVE.includes(now.status)) return { status: "busy", export: await toVideoExport(now) }
  }

  const [row] = await db.insert(videoExport).values({ projectId, userId }).returning()

  let saved: Row
  try {
    const handle = await tasks.trigger<typeof renderVideo>(
      "render-video",
      {
        exportId: row.id,
        userId,
        projectId,
        projectName: project.name,
        width: project.width,
        height: project.height,
        fps: project.fps,
        durationInFrames: project.durationInFrames,
        doc: project.doc,
      },
      // One render at a time per user; the rest wait in the queue. Unstarted after 30 min, it expires.
      { concurrencyKey: userId, tags: [`project_${projectId}`], ttl: "30m" }
    )
    ;[saved] = await db.update(videoExport).set({ triggerRunId: handle.id }).where(eq(videoExport.id, row.id)).returning()
  } catch (error) {
    console.error("Couldn't start the render", error)
    ;[saved] = await db
      .update(videoExport)
      .set({ status: "failed", error: "Couldn't start the render. Try again in a moment.", finishedAt: new Date() })
      .where(eq(videoExport.id, row.id))
      .returning()
  }

  const value = await toVideoExport(saved)
  await publish(projectChannel(projectId), { type: "export", export: value })
  return { status: "started", export: value }
}

export type CancelExportResult = { status: "cancelled"; export: VideoExport } | { status: "finished" } | { status: "not-found" }

/**
 * Stops a running export: cancels its Trigger.dev run (the render stops; nothing is uploaded or
 * charged after that) and marks it cancelled.
 */
export async function cancelExport(userId: string, projectId: string, exportId: string): Promise<CancelExportResult> {
  const [row] = await db
    .select()
    .from(videoExport)
    .where(and(eq(videoExport.id, exportId), eq(videoExport.projectId, projectId), eq(videoExport.userId, userId)))
    .limit(1)
  if (!row) return { status: "not-found" }
  if (!ACTIVE.includes(row.status)) return { status: "finished" }

  if (row.triggerRunId) {
    try {
      await runs.cancel(row.triggerRunId)
    } catch (error) {
      // Already finished (or Trigger.dev unreachable): what the run reached is saved below if it ended.
      console.error("Couldn't cancel the render's run", error)
      const now = await syncFromRun(row)
      if (!ACTIVE.includes(now.status)) return { status: "finished" }
    }
  }
  const [saved] = await db
    .update(videoExport)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(videoExport.id, row.id), inArray(videoExport.status, ACTIVE)))
    .returning()
  if (!saved) return { status: "finished" }

  const value = await toVideoExport(saved)
  await publish(projectChannel(projectId), { type: "export", export: value })
  return { status: "cancelled", export: value }
}

/**
 * A finished export for the public share page (/share/[exportId]). Anyone with the link can watch
 * it: the id is a random UUID, and only finished exports are found.
 */
export async function getSharedExport(exportId: string): Promise<SharedExport | null> {
  if (!/^[0-9a-f-]{36}$/i.test(exportId)) return null
  const [row] = await db
    .select({
      id: videoExport.id,
      mp4Url: videoExport.mp4Url,
      finishedAt: videoExport.finishedAt,
      projectName: project.name,
      width: project.width,
      height: project.height,
    })
    .from(videoExport)
    .innerJoin(project, eq(project.id, videoExport.projectId))
    .where(and(eq(videoExport.id, exportId), eq(videoExport.status, "done")))
    .limit(1)
  if (!row?.mp4Url) return null
  return {
    id: row.id,
    projectName: row.projectName,
    width: row.width,
    height: row.height,
    mp4Url: row.mp4Url,
    hlsUrl: exportHlsUrl(row.mp4Url),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  }
}

/**
 * Asks ImageKit for the HLS playlist. The first request starts preparing the streams and answers
 * 202; once they're ready it answers 200. Done on the server so the browser only polls our route.
 */
export async function checkStream(hlsUrl: string): Promise<StreamStatus> {
  try {
    const response = await fetch(hlsUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
    await response.text() // the playlist is tiny; reading it (not cancelling the body) frees the request
    if (response.status === 202) return { status: "processing" }
    return response.ok ? { status: "ready" } : { status: "unavailable" }
  } catch {
    return { status: "unavailable" }
  }
}
