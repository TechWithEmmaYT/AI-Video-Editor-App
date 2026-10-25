import type { ProjectFormat } from "@/types/project"

export const FPS = 30
export const MAX_SECONDS = 300
/** New projects start at this length; Claude or the editor can change it later. */
export const DEFAULT_SECONDS = 15

export const FORMATS: Record<ProjectFormat, { label: string; width: number; height: number; usedFor: string }> = {
  "16:9": { label: "Landscape", width: 1920, height: 1080, usedFor: "YouTube, web, slides" },
  "9:16": { label: "Vertical", width: 1080, height: 1920, usedFor: "Reels, TikTok, Shorts" },
  "1:1": { label: "Square", width: 1080, height: 1080, usedFor: "Feed posts" },
}

export const FORMAT_ORDER: ProjectFormat[] = ["16:9", "9:16", "1:1"]

/** "15 s" under a minute, "1:05" from a minute up. */
export function formatLength(durationInFrames: number, fps = FPS) {
  const seconds = Math.round(durationInFrames / fps)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}
