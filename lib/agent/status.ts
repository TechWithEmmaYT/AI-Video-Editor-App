import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { claudeStatus } from "@/db/schema"

/** Records that the user's Claude Code just reached the MCP endpoint, and with which key. */
export async function markClaudeSeen(userId: string, keyId: string) {
  const now = new Date()
  await db
    .insert(claudeStatus)
    .values({ userId, lastSeenAt: now, keyId })
    .onConflictDoUpdate({ target: claudeStatus.userId, set: { lastSeenAt: now, keyId } })
}

/** When Claude Code was last seen for this user and the key it used, or null if never. */
export async function getClaudeStatus(userId: string) {
  const [row] = await db
    .select({ lastSeenAt: claudeStatus.lastSeenAt, keyId: claudeStatus.keyId })
    .from(claudeStatus)
    .where(eq(claudeStatus.userId, userId))
    .limit(1)
  return row ?? null
}

/** Forgets that Claude Code was ever seen, so the editor shows "Not connected" again. */
export async function clearClaudeSeen(userId: string) {
  await db.delete(claudeStatus).where(eq(claudeStatus.userId, userId))
}
