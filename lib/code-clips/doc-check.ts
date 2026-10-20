import { validateCode } from "@/lib/code-clips/validate"
import type { Doc } from "@/lib/project/schema"

/**
 * The first problem in code clips a change added or edited (unchanged code was checked when it
 * was written). Null when they're all fine. Used by the server for every save.
 */
export function changedCodeError(before: Doc, after: Doc): string | null {
  const previous = new Map(before.clips.flatMap((clip) => (clip.type === "code" ? [[clip.id, clip.code]] : [])))
  for (const clip of after.clips) {
    if (clip.type !== "code" || previous.get(clip.id) === clip.code) continue
    const error = validateCode(clip.code)
    if (error) return `Code clip "${clip.name}", line ${error.line}, column ${error.column}: ${error.message}`
  }
  return null
}
