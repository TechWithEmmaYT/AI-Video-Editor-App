import { z } from "zod"

import { MAX_CODE_BYTES, validateCode } from "@/lib/code-clips/validate"
import { ELEMENT_CATEGORIES, ELEMENT_LAYOUTS } from "@/lib/elements/types"
import { FPS, MAX_SECONDS } from "@/lib/project/formats"
import { paramDefSchema } from "@/lib/project/schema"

/** The code field, checked by the code-clip validator; its message carries the line for Claude to fix. */
export const codeSchema = z
  .string()
  .max(MAX_CODE_BYTES)
  .superRefine((code, ctx) => {
    const error = validateCode(code)
    if (error) ctx.addIssue({ code: "custom", message: `Line ${error.line}, column ${error.column}: ${error.message}` })
  })

/** Saving an element ("Mine"), from the Style tab or (later) Claude over MCP. */
export const saveElementSchema = z.object({
  name: z.string().trim().min(1, "Give the element a name.").max(80),
  category: z.enum(ELEMENT_CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  layout: z.enum(ELEMENT_LAYOUTS as [string, ...string[]]).default("callout"),
  code: codeSchema,
  paramSchema: z.array(paramDefSchema).max(40),
  defaultParams: z.record(z.string(), z.unknown()),
  fonts: z.array(z.string().max(100)).max(10),
  defaultDurationInFrames: z.number().int().min(1).max(MAX_SECONDS * FPS),
})

export type SaveElementInput = z.input<typeof saveElementSchema>
