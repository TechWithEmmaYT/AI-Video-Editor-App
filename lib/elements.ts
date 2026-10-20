import "server-only"

import { desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { element } from "@/db/schema"
import type { ElementDef } from "@/lib/elements/types"
import type { saveElementSchema } from "@/lib/elements/validation"
import type { z } from "zod"

// "Mine" elements, scoped to their owner. Built-ins live in code (lib/elements/builtin).

type Row = typeof element.$inferSelect

function toElement(row: Row): ElementDef {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    layout: row.layout,
    code: row.code,
    paramSchema: row.paramSchema,
    defaultParams: row.defaultParams,
    fonts: row.fonts,
    defaultDurationInFrames: row.defaultDurationInFrames,
    createdBy: row.createdBy,
  }
}

export async function listElements(userId: string) {
  const rows = await db.select().from(element).where(eq(element.userId, userId)).orderBy(desc(element.updatedAt))
  return rows.map(toElement)
}

/** Saves an element. The input is already checked by saveElementSchema (including the code). */
export async function createElement(userId: string, input: z.output<typeof saveElementSchema>, createdBy: "user" | "claude") {
  const [row] = await db
    .insert(element)
    .values({
      ...input,
      category: input.category as ElementDef["category"],
      layout: input.layout as ElementDef["layout"],
      userId,
      createdBy,
    })
    .returning()
  return toElement(row)
}
