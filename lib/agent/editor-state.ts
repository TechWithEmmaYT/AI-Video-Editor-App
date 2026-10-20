import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { editorState } from "@/db/schema"

/** Records what the user has open, so Claude can resolve "this". */
export async function setEditorState(userId: string, projectId: string, selectedClipId: string | null) {
  await db
    .insert(editorState)
    .values({ userId, projectId, selectedClipId })
    .onConflictDoUpdate({ target: editorState.userId, set: { projectId, selectedClipId, updatedAt: new Date() } })
}

/** The project open in the user's editor and the selected clip (both may be null). */
export async function getEditorState(userId: string) {
  const [row] = await db.select().from(editorState).where(eq(editorState.userId, userId)).limit(1)
  return { projectId: row?.projectId ?? null, selectedClipId: row?.selectedClipId ?? null, updatedAt: row?.updatedAt ?? null }
}
