import { z } from "zod"

import { DEFAULT_SECONDS, MAX_SECONDS } from "@/lib/project/formats"
import { envConfig } from "../env"

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Keep the name under 80 characters.")
    .transform((name) => name || "Untitled"),
  format: z.enum(["16:9", "9:16", "1:1"], { error: "Pick a format: 16:9, 9:16 or 1:1." }),
  durationSeconds: z
    .number()
    .int("Length must be whole seconds.")
    .min(1, "Length must be at least 1 second.")
    .max(MAX_SECONDS, `Length can be at most ${MAX_SECONDS} seconds.`)
    .default(DEFAULT_SECONDS),
})

export const createMediaSchema = z.object({
  kind: z.enum(["video", "image", "audio"]),
  name: z.string().trim().min(1).max(200),
  mime: z.string().min(1),
  size: z.number().int().positive(),
  imagekitFileId: z.string().min(1),
  filePath: z.string().min(1),
  url: z
    .url()
    .refine((url) => url.startsWith(envConfig.imagekit.urlEndpoint), "Media must be hosted on ImageKit."),
  thumbnailUrl: z.url().nullable(),
  width: z.number().positive().nullable(),
  height: z.number().positive().nullable(),
  durationSec: z.number().positive().nullable(),
  contactSheetUrl: z
    .url()
    .refine((url) => url.startsWith(envConfig.imagekit.urlEndpoint), "The contact sheet must be hosted on ImageKit.")
    .nullable()
    .default(null),
})

export type CreateMediaInput = z.infer<typeof createMediaSchema>