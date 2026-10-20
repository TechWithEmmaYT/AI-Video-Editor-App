import type { Clip, Doc } from "@/lib/project/schema"
import { formatTimestamp } from "@/lib/transcript"

/*
 * What Claude reads about a project: a compact, ordered summary (tracks top to bottom, clips in time
 * order, times in seconds and frames) that's quicker to reason about than the raw JSON.
 */

export type ProjectInfo = {
  id: string
  name: string
  format: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  version: number
  doc: Doc
}

const sec = (frames: number, fps: number) => formatTimestamp(frames / fps)
const range = (from: number, to: number, fps: number) => `${sec(from, fps)}–${sec(to, fps)} (frames ${from}–${to})`

function clipLine(clip: Clip, fps: number) {
  const end = clip.from + clip.durationInFrames
  const t = clip.transform
  const box = `box x${Math.round(t.x)} y${Math.round(t.y)} ${Math.round(t.width)}×${Math.round(t.height)}${t.scale !== 1 ? ` scale ${t.scale}` : ""}${t.rotation ? ` rot ${t.rotation}°` : ""}${t.opacity !== 1 ? ` opacity ${t.opacity}` : ""}`
  const head = `- ${clip.id} · ${clip.type} "${clip.name}" · ${range(clip.from, end, fps)}`

  switch (clip.type) {
    case "video":
    case "audio": {
      const source = `${sec(clip.trimStartFrames, fps)}–${sec(clip.trimStartFrames + clip.durationInFrames, fps)}`
      const extra = clip.type === "video" ? ` · fit ${clip.fit}${clip.radius ? ` · radius ${clip.radius}` : ""} · ${box}` : clip.fadeInFrames || clip.fadeOutFrames ? ` · fades ${sec(clip.fadeInFrames, fps)}/${sec(clip.fadeOutFrames, fps)}` : ""
      return `${head} · media ${clip.mediaId} plays source ${source} · volume ${clip.volume}${extra}`
    }
    case "image":
      return `${head} · media ${clip.mediaId} · fit ${clip.fit}${clip.radius ? ` · radius ${clip.radius}` : ""} · ${box}`
    case "text":
      return `${head} · "${clip.text.replace(/\n/g, " / ")}" · ${clip.fontFamily} ${clip.fontWeight} ${clip.fontSize}px ${clip.color} ${clip.align} · ${box}`
    case "code": {
      const params = Object.entries(clip.params)
        .filter(([, value]) => typeof value !== "string" || value.length <= 80)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")
      return `${head} · ${clip.elementId ? `element ${clip.elementId}` : "custom code"} · ${box}${params ? ` · ${params}` : ""}`
    }
  }
}

export function describeProject(project: ProjectInfo, selectedClipId: string | null = null) {
  const { doc, fps } = project
  const lines = [
    `Project "${project.name}" (id ${project.id}) · ${project.format} ${project.width}×${project.height} · ${fps} fps · ${sec(project.durationInFrames, fps)} long (${project.durationInFrames} frames) · version ${project.version}`,
  ]

  const selected = doc.clips.find((clip) => clip.id === selectedClipId)
  lines.push(selected ? `"this" = ${selected.id} (${selected.type} "${selected.name}")` : `"this" = nothing selected`)

  if (doc.sections.length) {
    lines.push("", "Sections:")
    for (const s of [...doc.sections].sort((a, b) => a.from - b.from)) lines.push(`- ${s.id} · "${s.name}" · ${range(s.from, s.to, fps)}`)
  }

  lines.push("", doc.tracks.length ? "Tracks (top to bottom; the top track draws on top):" : "No tracks yet: the timeline is empty.")
  doc.tracks.forEach((track, index) => {
    const clips = doc.clips.filter((clip) => clip.trackId === track.id).sort((a, b) => a.from - b.from)
    lines.push(`${index + 1}. track ${track.id}${track.name ? ` "${track.name}"` : ""} (${clips.length} clip${clips.length === 1 ? "" : "s"})`)
    for (const clip of clips) lines.push(`   ${clipLine(clip, fps)}`)
  })
  return lines.join("\n")
}
