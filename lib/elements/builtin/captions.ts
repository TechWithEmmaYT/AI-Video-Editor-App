import type { ElementDef } from "@/lib/elements/types"

/**
 * One caption phrase (1–4 words) appearing word by word, in sync with the speech.
 * `*word*` marks the emphasis word (default: red Playfair Display Italic); `times` holds each
 * word's start in seconds from the clip's start, taken from the transcript's word timings.
 * Used by the "Reel captions + b-roll" brief (lib/agent/briefs/reel-captions.ts).
 */
export const kineticCaption: ElementDef = {
  id: "kinetic-caption",
  name: "Kinetic Caption",
  category: "titles",
  layout: "caption",
  defaultDurationInFrames: 45,
  fonts: ["Inter", "Playfair Display"],
  paramSchema: [
    { key: "text", label: "Text (*word* = emphasis)", type: "text", default: "make it *move*" },
    { key: "times", label: "Word times (s, comma-separated)", type: "text", default: "" },
    { key: "font", label: "Font", type: "font", default: "Inter" },
    { key: "weight", label: "Weight", type: "number", default: 900, min: 100, max: 900, step: 100 },
    { key: "color", label: "Colour", type: "color", default: "#ffffff" },
    { key: "scale", label: "Size", type: "number", default: 1, min: 0.3, max: 2, step: 0.05 },
    { key: "emphasisFont", label: "Emphasis font", type: "font", default: "Playfair Display" },
    { key: "emphasisWeight", label: "Emphasis weight", type: "number", default: 700, min: 100, max: 900, step: 100 },
    { key: "emphasisColor", label: "Emphasis colour", type: "color", default: "#ff3b30" },
    { key: "emphasisItalic", label: "Emphasis italic", type: "boolean", default: true },
    { key: "emphasisScale", label: "Emphasis size", type: "number", default: 1.12, min: 0.5, max: 2, step: 0.02 },
    { key: "animation", label: "Animation", type: "select", default: "pop", options: ["pop", "slide", "fade"] },
    { key: "shadow", label: "Shadow (for busy b-roll)", type: "boolean", default: true },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `// Words appear one by one. *word* marks the emphasis word. times = each word's start in seconds
// from the clip's start (from the transcript); without them the words spread over the first 60%.
const words = String(p.text).split(" ").filter(Boolean).map((raw) => {
  const emphasis = raw.length > 2 && raw.startsWith("*") && raw.endsWith("*")
  return { text: emphasis ? raw.slice(1, -1) : raw, emphasis }
})
if (words.length === 0) return

const given = String(p.times).split(",").map((s) => parseFloat(s)).filter((n) => isFinite(n))
const clipSeconds = u > 0 ? t / u : 1
const starts = words.map((_, i) => (given.length === words.length ? given[i] : (i * clipSeconds * 0.6) / words.length))

const base = h * 0.55 * p.scale
const fontFor = (word, size) =>
  word.emphasis
    ? M.font(p.emphasisFont, p.emphasisWeight, size * p.emphasisScale, p.emphasisItalic ? "italic" : "normal")
    : M.font(p.font, p.weight, size)

// Fit the phrase on one line.
const measure = (size) =>
  words.map((word) => {
    ctx.font = fontFor(word, size)
    return ctx.measureText(word.text).width
  })
const gapFor = (size) => size * 0.26
let widths = measure(base)
let total = widths.reduce((a, b) => a + b, 0) + gapFor(base) * (words.length - 1)
const fit = total > w * 0.96 ? (w * 0.96) / total : 1
const size = base * fit
widths = widths.map((width) => width * fit)
total = total * fit

if (p.shadow) {
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
  ctx.shadowBlur = size * 0.12
  ctx.shadowOffsetY = size * 0.04
}
ctx.textAlign = "center"
ctx.textBaseline = "alphabetic"
const outro = 1 - M.clamp((u - 0.94) / 0.06)
const baseline = h / 2 + size * 0.36

let x = (w - total) / 2
words.forEach((word, i) => {
  const k = M.clamp((t - starts[i]) / 0.16)
  const center = x + widths[i] / 2
  x += widths[i] + gapFor(size)
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = M.clamp(k * 2) * outro
  const lift = p.animation === "slide" ? (1 - M.ease.outCubic(k)) * size * 0.4 : 0
  ctx.translate(center, baseline + lift)
  if (p.animation === "pop") {
    const s = 0.6 + 0.4 * M.ease.outBack(k)
    ctx.scale(s, s)
  }
  ctx.font = fontFor(word, size)
  ctx.fillStyle = word.emphasis ? p.emphasisColor : p.color
  ctx.fillText(word.text, 0, 0)
  ctx.restore()
})`,
}
