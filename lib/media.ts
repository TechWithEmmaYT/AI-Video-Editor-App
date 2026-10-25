import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/app-schema";
import type { Media } from "@/types/project";
import { CreateMediaInput } from "./project/validation";

type Row = typeof media.$inferSelect;

function toMedia(row: Row): Media {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    name: row.name,
    mime: row.mime,
    size: row.size,
    imagekitFileId: row.imagekitFileId,
    filePath: row.filePath,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    width: row.width,
    height: row.height,
    durationSec: row.durationSec,
    contactSheetUrl: row.contactSheetUrl,
    transcriptSource: row.transcript?.source ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMedia(projectId: string) {
  const rows = await db
    .select()
    .from(media)
    .where(eq(media.projectId, projectId))
    .orderBy(desc(media.createdAt));
  return rows.map(toMedia);
}

export async function createMedia(
  userId: string,
  projectId: string,
  mediaData: CreateMediaInput,
) {
  const [row] = await db
    .insert(media)
    .values({ ...mediaData, userId, projectId })
    .returning();
  return toMedia(row);
}
