import type { ElementDef } from "@/lib/elements/types"

/**
 * Spoken captions, in sync with the speech. `*word*` marks an emphasis word (default: red
 * Playfair Display Italic) and `|` starts a new line; `times` holds each word's start in seconds
 * from the clip's start, taken from the transcript's word timings.
 *
 * `mode` is the difference between the reference looks: "replace" shows one phrase at a time,
 * "words" leaves spoken words standing while the newest one is brightest, and "lines" stacks whole
 * lines as they're said. `highlight` draws the marker box behind a word — as an entrance that
 * sweeps away, or held on the emphasis words.
 *
 * Used by the talking-head briefs (lib/agent/briefs/talking-head.ts).
 */
export const kineticCaption: ElementDef = {
  id: "kinetic-caption",
  name: "Kinetic Caption",
  category: "titles",
  layout: "caption",
  defaultDurationInFrames: 45,
  fonts: ["Inter", "Playfair Display"],
  paramSchema: [
    { key: "text", label: "Text (*word* = emphasis, | = new line)", type: "text", default: "make it *move*" },
    { key: "times", label: "Word times (s, comma-separated)", type: "text", default: "" },
    { key: "mode", label: "Build", type: "select", default: "replace", options: ["replace", "words", "lines"] },
    { key: "font", label: "Font", type: "font", default: "Inter" },
    { key: "weight", label: "Weight", type: "number", default: 900, min: 100, max: 900, step: 100 },
    { key: "color", label: "Colour", type: "color", default: "#ffffff" },
    { key: "scale", label: "Size", type: "number", default: 1, min: 0.3, max: 2, step: 0.05 },
    { key: "pastOpacity", label: "Already-said words", type: "number", default: 1, min: 0.15, max: 1, step: 0.05 },
    { key: "emphasisFont", label: "Emphasis font", type: "font", default: "Playfair Display" },
    { key: "emphasisWeight", label: "Emphasis weight", type: "number", default: 700, min: 100, max: 900, step: 100 },
    { key: "emphasisColor", label: "Emphasis colour", type: "color", default: "#ff3b30" },
    { key: "emphasisItalic", label: "Emphasis italic", type: "boolean", default: true },
    { key: "emphasisScale", label: "Emphasis size", type: "number", default: 1.12, min: 0.5, max: 2, step: 0.02 },
    { key: "highlight", label: "Marker", type: "select", default: "none", options: ["none", "box", "underline"] },
    { key: "highlightColor", label: "Marker colour", type: "color", default: "#ff3b30" },
    { key: "highlightHold", label: "Keep marker on emphasis words", type: "boolean", default: false },
    { key: "animation", label: "Animation", type: "select", default: "pop", options: ["pop", "slide", "fade"] },
    { key: "shadow", label: "Shadow (for busy b-roll)", type: "boolean", default: true },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `// Words appear one by one at their own time. "|" starts a new line; *word* marks emphasis.
// times = each word's start in seconds from the clip's start (flat, across every line).
const lines = String(p.text).split("|").map((line) =>
  line.trim().split(" ").filter(Boolean).map((raw) => {
    const emphasis = raw.length > 2 && raw.startsWith("*") && raw.endsWith("*")
    return { text: emphasis ? raw.slice(1, -1) : raw, emphasis }
  })
).filter((line) => line.length > 0)
if (lines.length === 0) return

const flat = []
lines.forEach((line, row) => line.forEach((word) => { word.row = row; word.index = flat.length; flat.push(word) }))

const given = String(p.times).split(",").map((s) => parseFloat(s)).filter((n) => isFinite(n))
const clipSeconds = u > 0 ? t / u : 1
const starts = flat.map((_, i) => (given.length === flat.length ? given[i] : (i * clipSeconds * 0.6) / flat.length))

// Which word is being said now: the last one that has started.
let live = -1
for (let i = 0; i < flat.length; i++) if (t >= starts[i]) live = i
const liveRow = live >= 0 ? flat[live].row : -1

const base = h * 0.55 * p.scale
const fontFor = (word, size) =>
  word.emphasis
    ? M.font(p.emphasisFont, p.emphasisWeight, size * p.emphasisScale, p.emphasisItalic ? "italic" : "normal")
    : M.font(p.font, p.weight, size)
const gapFor = (size) => size * 0.26

// Lay the words out at this size, wrapping each line that runs past the box. "|" is a hard break.
const layout = (size) => {
  const rows = []
  lines.forEach((line, lineIndex) => {
    let row = { lineIndex, words: [], width: 0 }
    for (const word of line) {
      ctx.font = fontFor(word, size)
      const width = ctx.measureText(word.text).width
      const gap = row.words.length ? gapFor(size) : 0
      if (row.words.length && row.width + gap + width > w * 0.96) {
        rows.push(row)
        row = { lineIndex, words: [], width: 0 }
      }
      row.width += (row.words.length ? gapFor(size) : 0) + width
      row.words.push({ word, width })
    }
    if (row.words.length) rows.push(row)
  })
  return rows
}

// Shrink until the wrapped rows fit the box's height, rather than squeezing one long line to nothing.
let size = base
let rows = layout(size)
while (rows.length * size * 1.2 > h && size > base * 0.3) {
  size *= 0.9
  rows = layout(size)
}
const lineHeight = size * 1.2

ctx.textAlign = "center"
ctx.textBaseline = "alphabetic"
const outro = 1 - M.clamp((u - 0.94) / 0.06)
const top = (h - lineHeight * rows.length) / 2

rows.forEach((row, rowIndex) => {
  // In "lines" mode a line waits for its own first word; otherwise every line is laid out at once.
  if (p.mode === "lines" && lines[row.lineIndex][0].index > live) return
  const baseline = top + lineHeight * rowIndex + size * 0.82
  let x = (w - row.width) / 2

  row.words.forEach(({ word, width }) => {
    const k = M.clamp((t - starts[word.index]) / 0.16)
    const center = x + width / 2
    x += width + gapFor(size)
    if (k <= 0) return

    // Words already said step back, so the live one reads first.
    const settled =
      p.mode === "words" ? (word.index === live ? 1 : p.pastOpacity)
      : p.mode === "lines" ? (row.lineIndex === liveRow ? 1 : p.pastOpacity)
      : 1

    ctx.save()
    ctx.globalAlpha = M.clamp(k * 2) * settled * outro
    const lift = p.animation === "slide" ? (1 - M.ease.outCubic(k)) * size * 0.4 : 0
    ctx.translate(center, baseline + lift)
    if (p.animation === "pop") { const s = 0.6 + 0.4 * M.ease.outBack(k); ctx.scale(s, s) }

    // The marker: held on emphasis words, or sweeping in behind each word and away again.
    if (p.highlight !== "none") {
      const held = p.highlightHold && word.emphasis
      const sweep = M.clamp((t - starts[word.index]) / 0.22)
      const show = held ? M.ease.outCubic(k) : M.ease.outCubic(k) * (1 - M.ease.outCubic(M.clamp((sweep - 0.55) / 0.45)))
      if (show > 0.01) {
        ctx.save()
        ctx.globalAlpha *= show
        ctx.fillStyle = p.highlightColor
        const padX = size * 0.14
        if (p.highlight === "underline") {
          ctx.fillRect(-width / 2 - padX, size * 0.18, (width + padX * 2) * show, size * 0.12)
        } else {
          const boxW = (width + padX * 2) * (held ? 1 : show)
          ctx.beginPath()
          ctx.roundRect(-boxW / 2, -size * 0.78, boxW, size * 1.02, size * 0.08)
          ctx.fill()
        }
        ctx.restore()
      }
    }

    if (p.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = size * 0.12
      ctx.shadowOffsetY = size * 0.04
    }
    ctx.font = fontFor(word, size)
    // A word sitting on a held marker reads as white, not as the marker's own colour.
    ctx.fillStyle = p.highlightHold && word.emphasis && p.highlight === "box" ? "#ffffff" : word.emphasis ? p.emphasisColor : p.color
    ctx.fillText(word.text, 0, 0)
    ctx.restore()
  })
})`,
}
