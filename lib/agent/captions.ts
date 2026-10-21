import type { Transcript } from "@/lib/transcript"

/*
 * Turning a transcript into caption phrases. Pure, so the tool can resolve the media and the
 * speaker clip first and the split itself stays testable.
 *
 * A phrase is what one Kinetic Caption clip shows: a few words, their start times relative to
 * the clip, and where it sits on the timeline.
 */

export type CaptionWord = { text: string; start: number; end: number }
export type CaptionPhrase = {
  /** The words, joined, with the emphasis word wrapped in asterisks and `|` between lines. */
  text: string
  /** Each word's start in seconds from the phrase's start, to 2 decimals. */
  times: string
  /** Source seconds. */
  start: number
  end: number
  words: number
}

/** Every word in the range, from word timings where the transcript has them, else spread over its line. */
export function wordsIn(transcript: Transcript, from: number, to: number): CaptionWord[] {
  const words: CaptionWord[] = []
  for (const segment of transcript.segments) {
    if (segment.end <= from || segment.start >= to) continue
    if (segment.words?.length) {
      for (const word of segment.words) {
        if (word.end <= from || word.start >= to) continue
        if (word.text.trim()) words.push({ text: word.text.trim(), start: word.start, end: word.end })
      }
      continue
    }
    // No word timings: spread the line's words evenly across it.
    const pieces = segment.text.split(/\s+/).filter(Boolean)
    const each = (segment.end - segment.start) / Math.max(1, pieces.length)
    pieces.forEach((text, i) => {
      const start = segment.start + each * i
      if (start + each <= from || start >= to) return
      words.push({ text, start, end: start + each })
    })
  }
  return words.sort((a, b) => a.start - b.start)
}

/**
 * Splits words into phrases of at most `maxWords`, breaking early at a sentence end or at a gap
 * of `pauseSeconds` or more, so a phrase never runs across a natural break in the speech.
 * `linesPerPhrase` above 1 joins that many phrases into one stacked clip, separated by `|`.
 */
export function splitPhrases(
  words: CaptionWord[],
  { maxWords, pauseSeconds, linesPerPhrase }: { maxWords: number; pauseSeconds: number; linesPerPhrase: number }
): CaptionPhrase[] {
  const lines: CaptionWord[][] = []
  let line: CaptionWord[] = []
  words.forEach((word, i) => {
    line.push(word)
    const next = words[i + 1]
    const ended = /[.!?]$/.test(word.text)
    const comma = /[,;:]$/.test(word.text)
    const gap = next ? next.start - word.end : Infinity
    if (line.length >= maxWords || ended || gap >= pauseSeconds || (comma && line.length >= maxWords - 1) || !next) {
      lines.push(line)
      line = []
    }
  })
  if (line.length) lines.push(line)

  const phrases: CaptionPhrase[] = []
  for (let i = 0; i < lines.length; i += linesPerPhrase) {
    const group = lines.slice(i, i + linesPerPhrase)
    const flat = group.flat()
    const start = flat[0].start
    phrases.push({
      text: group.map((row) => row.map((word) => word.text).join(" ")).join(" | "),
      times: flat.map((word) => (word.start - start).toFixed(2)).join(", "),
      start,
      end: flat[flat.length - 1].end,
      words: flat.length,
    })
  }
  return phrases
}

/**
 * Marks one word per phrase as the emphasis word: the longest word that isn't a filler, since
 * that's almost always the noun, verb or number the phrase turns on. Phrases of one word are left
 * alone — a phrase that is entirely its own emphasis reads as shouting.
 */
const FILLER = new Set([
  "about", "after", "again", "could", "every", "going", "might", "other", "right", "should", "their", "there",
  "these", "thing", "think", "those", "where", "which", "while", "would", "really", "actually", "because",
])

export function markEmphasis(phrase: CaptionPhrase): CaptionPhrase {
  const rows = phrase.text.split(" | ")
  const flat = rows.flatMap((row) => row.split(" "))
  if (flat.length < 2) return phrase

  let best = -1
  let bestScore = 0
  flat.forEach((word, i) => {
    const bare = word.replace(/[^\p{L}\p{N}]/gu, "")
    if (!bare || FILLER.has(bare.toLowerCase())) return
    // Numbers win outright; otherwise the longest word.
    const score = /\d/.test(bare) ? 100 : bare.length
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  })
  if (best < 0 || bestScore < 4) return phrase

  let seen = 0
  const text = rows
    .map((row) =>
      row
        .split(" ")
        .map((word) => (seen++ === best ? `*${word}*` : word))
        .join(" ")
    )
    .join(" | ")
  return { ...phrase, text }
}
