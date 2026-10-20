import "server-only"

import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { project } from "@/db/schema"
import { changedCodeError } from "@/lib/code-clips/doc-check"
import { FORMATS, FPS } from "@/lib/project/formats"
import { applyOps, OpError, type Op, type ProjectData } from "@/lib/project/ops"
import { docSchema, EMPTY_DOC } from "@/lib/project/schema"
import type { CreateProjectInput, Project, ProjectWithDoc } from "@/types/project"

// Data access for projects. Every query is scoped to the owner.

const summary = {
  id: project.id,
  name: project.name,
  format: project.format,
  width: project.width,
  height: project.height,
  fps: project.fps,
  durationInFrames: project.durationInFrames,
  thumbnailUrl: project.thumbnailUrl,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
}

type Row = Omit<Project, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date }

function toProject(row: Row): Project {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

export async function listProjects(userId: string) {
  const rows = await db
    .select(summary)
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt))
  return rows.map(toProject)
}

export async function getProject(userId: string, id: string) {
  const [row] = await db
    .select(summary)
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1)
  return row ? toProject(row) : null
}

/** A project with its timeline doc and version, for the editor. */
export async function getProjectWithDoc(userId: string, id: string): Promise<ProjectWithDoc | null> {
  const [row] = await db
    .select({ ...summary, doc: project.doc, version: project.version })
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1)
  return row ? { ...toProject(row), doc: row.doc, version: row.version } : null
}

export type ApplyOpsResult =
  | { status: "ok"; version: number }
  | { status: "not-found" }
  | { status: "invalid"; message: string }
  | { status: "conflict" }

/**
 * Applies ops with the shared reducer and saves the result. Uses the version column as an
 * optimistic lock (retrying a few times), so two quick writers can't lose each other's ops.
 */
export async function applyProjectOps(userId: string, id: string, ops: Op[]): Promise<ApplyOpsResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db
      .select({
        name: project.name,
        durationInFrames: project.durationInFrames,
        format: project.format,
        doc: project.doc,
        version: project.version,
      })
      .from(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .limit(1)
    if (!row) return { status: "not-found" }

    let next: ProjectData
    try {
      next = applyOps({ name: row.name, durationInFrames: row.durationInFrames, format: row.format, doc: row.doc }, ops)
    } catch (error) {
      if (error instanceof OpError) return { status: "invalid", message: error.message }
      throw error
    }
    const checked = docSchema.safeParse(next.doc)
    if (!checked.success) return { status: "invalid", message: checked.error.issues[0]?.message ?? "Invalid project." }
    // Code clips: run the validator on any code this change wrote (the plan, §7).
    const codeError = changedCodeError(row.doc, checked.data)
    if (codeError) return { status: "invalid", message: codeError }

    const saved = await db
      .update(project)
      .set({
        name: next.name,
        durationInFrames: next.durationInFrames,
        format: next.format,
        width: FORMATS[next.format].width,
        height: FORMATS[next.format].height,
        doc: checked.data,
        version: row.version + 1,
      })
      .where(and(eq(project.id, id), eq(project.userId, userId), eq(project.version, row.version)))
      .returning({ version: project.version })
    if (saved.length) return { status: "ok", version: saved[0].version }
  }
  return { status: "conflict" }
}

export async function createProject(userId: string, input: Required<CreateProjectInput>) {
  const { width, height } = FORMATS[input.format]
  const [row] = await db
    .insert(project)
    .values({
      userId,
      name: input.name,
      format: input.format,
      width,
      height,
      fps: FPS,
      durationInFrames: input.durationSeconds * FPS,
      doc: EMPTY_DOC,
    })
    .returning(summary)
  return toProject(row)
}
