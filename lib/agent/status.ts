import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { claudeStatus } from "@/db/schema"

/** Records that the user's Claude Code just reached the MCP endpoint. */
export async function markClaudeSeen(userId: string) {
  const now = new Date()
  await db
    .insert(claudeStatus)
    .values({ userId, lastSeenAt: now })
    .onConflictDoUpdate({ target: claudeStatus.userId, set: { lastSeenAt: now } })
}

/** When Claude Code was last seen for this user, or null if never. */
export async function getClaudeLastSeen(userId: string) {
  const [row] = await db.select({ lastSeenAt: claudeStatus.lastSeenAt }).from(claudeStatus).where(eq(claudeStatus.userId, userId)).limit(1)
  return row?.lastSeenAt ?? null
}

/** Forgets that Claude Code was ever seen, so the editor shows "Not connected" again. */
export async function clearClaudeSeen(userId: string) {
  await db.delete(claudeStatus).where(eq(claudeStatus.userId, userId))
}
