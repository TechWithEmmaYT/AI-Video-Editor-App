import { z } from "zod"

/*
 * A media file's transcript, in one shape whatever it came from: ImageKit's AI transcription
 * ({url}/ik-gensubtitle.transcript + {url}/ik-genchapter.vtt), or the user's own .srt / .vtt /
 * pasted timed text. Times are seconds into the source file.
 */

const seconds = z.number().min(0)

export const transcriptSchema = z.object({
  source: z.enum(["imagekit", "user"]),
  language: z.string().max(20).optional(),
  segments: z
    .array(
      z.object({
        start: seconds,
        end: seconds,
        text: z.string().max(5000),
        words: z.array(z.object({ start: seconds, end: seconds, text: z.string().max(200) })).optional(),
      })
    )
    .min(1, "The transcript has no lines.")
    .max(20_000),
  chapters: z.array(z.object({ start: seconds, title: z.string().max(200) })).max(500).optional(),
})

export type Transcript = z.infer<typeof transcriptSchema>
export type TranscriptSegment = Transcript["segments"][number]

// ── Time ────────────────────────────────────────────────────────────────

/** "01:02:03.450", "02:03,450", "2:03", "1:02:03" → seconds. Null if it isn't a time. */
export function parseTimestamp(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(value.trim())
  if (!match) return null
  const [, h, m, s, ms] = match
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + (ms ? Number(ms.padEnd(3, "0")) / 1000 : 0)
}

/** 67.25 → "1:07.2" */
export function formatTimestamp(value: number) {
  const tenths = Math.floor(value * 10)
  const h = Math.floor(tenths / 36000)
  const m = Math.floor((tenths % 36000) / 600)
  const s = ((tenths % 600) / 10).toFixed(1).padStart(4, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

// ── Parsers ─────────────────────────────────────────────────────────────

type Cue = { start: number; end: number; text: string }

/** Cues from SRT or WebVTT: blocks with a "start --> end" line followed by text lines. */
export function parseCues(input: string): Cue[] {
  const cues: Cue[] = []
  const blocks = input.replace(/\r\n?/g, "\n").replace(/^﻿/, "").split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split("\n")
    const timing = lines.findIndex((line) => line.includes("-->"))
    if (timing === -1) continue // WEBVTT header, NOTE, STYLE, …
    const [from, to] = lines[timing].split("-->").map((part) => part.trim().split(/\s+/)[0])
    const start = parseTimestamp(from)
    const end = parseTimestamp(to)
    // Strip VTT/SRT markup like <v Speaker>, <i>, {\an8}.
    const text = lines
      .slice(timing + 1)
      .join(" ")
      .replace(/<[^>]+>|\{[^}]+\}/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (start === null || end === null || !text) continue
    cues.push({ start, end: Math.max(start, end), text })
  }
  return cues
}

/**
 * Pasted timed text: SRT/VTT, or one line per moment like "0:07 So the first thing…" or
 * "[00:01:07.5] Next…". A line's end is the next line's start.
 */
export function parsePastedTranscript(input: string, durationSec?: number | null): Transcript | null {
  const cues = parseCues(input)
  if (cues.length > 0) return { source: "user", segments: cues }

  const timed: { start: number; text: string }[] = []
  for (const line of input.replace(/\r\n?/g, "\n").split("\n")) {
    const match = /^\s*\[?((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]?\s*[-–—:]?\s*(.+)$/.exec(line)
    const start = match ? parseTimestamp(match[1]) : null
    if (start !== null && match![2].trim()) timed.push({ start, text: match![2].trim() })
    else if (line.trim() && timed.length > 0) timed[timed.length - 1].text += ` ${line.trim()}` // wrapped line
  }
  if (timed.length === 0) return null
  timed.sort((a, b) => a.start - b.start)
  const segments = timed.map((item, i) => ({
    start: item.start,
    end: timed[i + 1]?.start ?? Math.max(item.start, durationSec ?? item.start + 5),
    text: item.text,
  }))
  return { source: "user", segments }
}

/** A .srt or .vtt file's text. Null if no timed lines were found. */
export function parseSubtitleFile(input: string): Transcript | null {
  const segments = parseCues(input)
  return segments.length > 0 ? { source: "user", segments } : null
}

/** ImageKit's {url}/ik-gensubtitle.transcript JSON, plus its {url}/ik-genchapter.vtt chapters if there are any. */
export function fromImageKit(json: unknown, chaptersVtt?: string | null): Transcript | null {
  const items = (json as { transcript?: unknown })?.transcript
  if (!Array.isArray(items)) return null
  const segments = items.flatMap((item): TranscriptSegment[] => {
    const { transcript, start, end, words } = item as {
      transcript?: unknown
      start?: unknown
      end?: unknown
      words?: { word?: unknown; start?: unknown; end?: unknown }[]
    }
    if (typeof transcript !== "string" || typeof start !== "number" || typeof end !== "number" || !transcript.trim()) return []
    return [
      {
        start,
        end: Math.max(start, end),
        text: transcript.trim(),
        words: Array.isArray(words)
          ? words.flatMap((w) =>
              typeof w.word === "string" && typeof w.start === "number" && typeof w.end === "number"
                ? [{ start: w.start, end: Math.max(w.start, w.end), text: w.word }]
                : []
            )
          : undefined,
      },
    ]
  })
  if (segments.length === 0) return null
  const chapters = chaptersVtt ? parseCues(chaptersVtt).map((cue) => ({ start: cue.start, title: cue.text })) : []
  return { source: "imagekit", segments, ...(chapters.length > 0 && { chapters }) }
}

// ── For Claude ──────────────────────────────────────────────────────────

/**
 * The transcript as compact lines, optionally only [from, to] seconds:
 *   Chapters: 0:00.0 Intro · 2:26.4 Real-time optimisation
 *   [0:07.2–0:09.8] So the first thing you do is…
 */
export function transcriptToText(transcript: Transcript, range: { from?: number; to?: number } = {}) {
  const from = range.from ?? 0
  const to = range.to ?? Infinity
  const lines: string[] = []
  const chapters = transcript.chapters?.filter((c) => c.start >= from && c.start < to) ?? []
  if (chapters.length > 0) lines.push(`Chapters: ${chapters.map((c) => `${formatTimestamp(c.start)} ${c.title}`).join(" · ")}`, "")
  for (const segment of transcript.segments) {
    if (segment.end < from || segment.start > to) continue
    lines.push(`[${formatTimestamp(segment.start)}–${formatTimestamp(segment.end)}] ${segment.text}`)
  }
  return lines.join("\n")
}
