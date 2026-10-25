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
    { key: "emphasisFit", label: "Smaller emphasis for long words", type: "boolean", default: false },
    { key: "highlight", label: "Marker", type: "select", default: "none", options: ["line", "none", "box", "underline"] },
    { key: "highlightColor", label: "Marker colour", type: "color", default: "#ff3b30" },
    { key: "highlightHold", label: "Keep marker on emphasis words", type: "boolean", default: false },
    { key: "animation", label: "Animation", type: "select", default: "pop", options: ["blur-rise", "pop", "slide", "fade"] },
    { key: "shadow", label: "Shadow (for busy b-roll)", type: "boolean", default: true },
    { key: "arrange", label: "Arrange", type: "select", default: "inline", options: ["lead-in", "inline"] },
    { key: "leadScale", label: "Lead-in size", type: "number", default: 0.4, min: 0.2, max: 1, step: 0.05 },
    { key: "leadOpacity", label: "Lead-in opacity", type: "number", default: 0.7, min: 0.15, max: 1, step: 0.05 },
    { key: "accentFont", label: "Accent font (~word~)", type: "font", default: "Instrument Serif" },
    { key: "accentWeight", label: "Accent weight", type: "number", default: 400, min: 100, max: 900, step: 100 },
    { key: "accentColor", label: "Accent colour", type: "color", default: "#ffffff" },
    { key: "accentItalic", label: "Accent italic", type: "boolean", default: true },
    { key: "serifFont", label: "Serif accent font (_word_)", type: "font", default: "Playfair Display" },
    { key: "serifWeight", label: "Serif accent weight", type: "number", default: 700, min: 100, max: 900, step: 100 },
    { key: "serifColor", label: "Serif accent colour", type: "color", default: "#ffffff" },
    { key: "serifScale", label: "Serif accent size", type: "number", default: 1.35, min: 0.5, max: 2, step: 0.05 },
    { key: "lowercase", label: "All lowercase", type: "boolean", default: false },
    { key: "tracking", label: "Letter spacing (em)", type: "number", default: 0, min: -0.15, max: 0.3, step: 0.01 },
    { key: "fill", label: "Letter fill", type: "select", default: "solid", options: ["texture", "solid"] },
    { key: "fillColor2", label: "Texture second colour", type: "color", default: "#c48b96" },
    { key: "fillOpacity", label: "Letter opacity", type: "number", default: 1, min: 0.3, max: 1, step: 0.05 },
    { key: "fitWidth", label: "Fill the width", type: "boolean", default: false },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `// Words appear one by one at their own time. "|" starts a new line; *word* marks emphasis, ~word~ an accent,
// _word_ a serif italic accent.
// times = each word's start in seconds from the clip's start (flat, across every line).
const lines = String(p.text).split("|").map((line) =>
  line.trim().split(" ").filter(Boolean).map((raw) => {
    const emphasis = raw.length > 2 && raw.startsWith("*") && raw.endsWith("*")
    const accent = raw.length > 2 && raw.startsWith("~") && raw.endsWith("~")
    const serif = raw.length > 2 && raw.startsWith("_") && raw.endsWith("_")
    const text = emphasis || accent || serif ? raw.slice(1, -1) : raw
    return { text: p.lowercase ? text.toLowerCase() : text, emphasis, accent, serif }
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

// "lead-in" splits a line in two: its lesser words small and faint on top, its key words big below.
const isKey = (word) => word.emphasis || word.accent
const groups = []
lines.forEach((line, lineIndex) => {
  const keys = line.filter(isKey)
  if (p.arrange !== "lead-in" || keys.length === 0 || keys.length === line.length) {
    groups.push({ lineIndex, words: line, tier: 1, lead: false })
    return
  }
  groups.push({ lineIndex, words: line.filter((word) => !isKey(word)), tier: p.leadScale, lead: true })
  groups.push({ lineIndex, words: keys, tier: 1, lead: false })
})

const base = h * 0.55 * p.scale
// A long key word at full emphasis size runs past the frame, so it grows less: full size up to 7
// characters, half as much at 8–9, not at all from 10.
const keyScale = (word) => {
  if (!p.emphasisFit || word.text.length <= 7) return p.emphasisScale
  if (word.text.length <= 9) return 1 + (p.emphasisScale - 1) / 2
  return Math.min(1, p.emphasisScale)
}
const setFont = (word, size) => {
  if (word.emphasis) ctx.font = M.font(p.emphasisFont, p.emphasisWeight, size * keyScale(word), p.emphasisItalic ? "italic" : "normal")
  else if (word.accent) ctx.font = M.font(p.accentFont, p.accentWeight, size * keyScale(word), p.accentItalic ? "italic" : "normal")
  // The serif is optically smaller than the sans beside it, so it takes its own, larger size.
  else if (word.serif) ctx.font = M.font(p.serifFont, p.serifWeight, size * p.serifScale, "italic")
  else ctx.font = M.font(p.font, p.weight, size)
  ctx.letterSpacing = p.tracking * size + "px"
}
const gapFor = (size) => size * 0.26

// Lay the words out at this size, wrapping each line that runs past the box. "|" is a hard break.
const layout = (size) => {
  const rows = []
  groups.forEach((group) => {
    const rowSize = size * group.tier
    let row = { lineIndex: group.lineIndex, lead: group.lead, size: rowSize, words: [], width: 0 }
    for (const word of group.words) {
      setFont(word, rowSize)
      const width = ctx.measureText(word.text).width
      const gap = row.words.length ? gapFor(rowSize) : 0
      if (row.words.length && row.width + gap + width > w * 0.96) {
        rows.push(row)
        row = { lineIndex: group.lineIndex, lead: group.lead, size: rowSize, words: [], width: 0 }
      }
      row.width += (row.words.length ? gapFor(rowSize) : 0) + width
      row.words.push({ word, width })
    }
    if (row.words.length) rows.push(row)
  })
  return rows
}
const heightOf = (rows) => {
  let total = 0
  for (const row of rows) total += row.size * 1.2
  return total
}

const widestOf = (rows) => {
  let widest = 0
  for (const row of rows) widest = Math.max(widest, row.width)
  return widest
}

// Shrink until the wrapped rows fit the box, rather than squeezing one long line to nothing. A single
// word wider than the box can't wrap, so it shrinks too instead of being cut off at the frame edge.
let size = base
let rows = layout(size)
while ((heightOf(rows) > h || widestOf(rows) > w) && size > base * 0.3) {
  size *= 0.9
  rows = layout(size)
}
// "Fill the width": grow or shrink so the widest row spans the box, as long as the rows still fit its height.
if (p.fitWidth) {
  const widest = widestOf(rows)
  if (widest > 0) {
    size = Math.min((size * w * 0.92) / widest, (size * h) / heightOf(rows))
    rows = layout(size)
  }
}

ctx.textAlign = "center"
ctx.textBaseline = "alphabetic"
const outro = 1 - M.clamp((u - 0.94) / 0.06)
const entrance = p.animation === "blur-rise" ? 0.3 : 0.16
let rowTop = (h - heightOf(rows)) / 2

rows.forEach((row) => {
  const rowSize = row.size
  const baseline = rowTop + rowSize * 0.82
  rowTop += rowSize * 1.2
  // In "lines" mode a line waits for its own first word; otherwise every line is laid out at once.
  if (p.mode === "lines" && lines[row.lineIndex][0].index > live) return
  let x = (w - row.width) / 2

  row.words.forEach(({ word, width }) => {
    const k = M.clamp((t - starts[word.index]) / entrance)
    const center = x + width / 2
    x += width + gapFor(rowSize)
    if (k <= 0) return

    // Words already said step back, so the live one reads first.
    const settled =
      p.mode === "words" ? (word.index === live ? 1 : p.pastOpacity)
      : p.mode === "lines" ? (row.lineIndex === liveRow ? 1 : p.pastOpacity)
      : 1

    ctx.save()
    ctx.globalAlpha = M.clamp(k * 2) * settled * outro * (row.lead ? p.leadOpacity : 1)
    const lift =
      p.animation === "slide" ? (1 - M.ease.outCubic(k)) * rowSize * 0.4
      : p.animation === "blur-rise" ? (1 - M.ease.outCubic(k)) * rowSize * 0.22
      : 0
    ctx.translate(center, baseline + lift)
    if (p.animation === "pop") { const s = 0.6 + 0.4 * M.ease.outBack(k); ctx.scale(s, s) }
    if (p.animation === "blur-rise" && k < 1) ctx.filter = "blur(" + (1 - M.ease.outCubic(k)) * rowSize * 0.12 + "px)"

    // The marker: held on emphasis words, or sweeping in behind each word and away again. A lead-in
    // only ever marks its emphasis word.
    if ((p.highlight === "box" || p.highlight === "underline") && (p.arrange !== "lead-in" || word.emphasis)) {
      const held = p.highlightHold && word.emphasis
      const sweep = M.clamp((t - starts[word.index]) / 0.22)
      const show = held ? M.ease.outCubic(k) : M.ease.outCubic(k) * (1 - M.ease.outCubic(M.clamp((sweep - 0.55) / 0.45)))
      if (show > 0.01) {
        ctx.save()
        ctx.globalAlpha *= show
        ctx.fillStyle = p.highlightColor
        const padX = rowSize * 0.14
        if (p.highlight === "underline") {
          ctx.fillRect(-width / 2 - padX, rowSize * 0.18, (width + padX * 2) * show, rowSize * 0.12)
        } else {
          const boxW = (width + padX * 2) * (held ? 1 : show)
          ctx.beginPath()
          ctx.roundRect(-boxW / 2, -rowSize * 0.78, boxW, rowSize * 1.02, rowSize * 0.08)
          ctx.fill()
        }
        ctx.restore()
      }
    }
    // A thin line drawn on from the left under each emphasis word as it lands, then held.
    if (p.highlight === "line" && word.emphasis) {
      const drawn = M.ease.inOutCubic(M.clamp((t - starts[word.index] - 0.08) / 0.4))
      if (drawn > 0) {
        ctx.fillStyle = p.highlightColor
        ctx.beginPath()
        ctx.roundRect(-width / 2, rowSize * 0.16, width * drawn, rowSize * 0.055, rowSize * 0.03)
        ctx.fill()
      }
    }

    if (p.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = rowSize * 0.12
      ctx.shadowOffsetY = rowSize * 0.04
    }
    setFont(word, rowSize)
    // A word sitting on a held marker reads as white, not as the marker's own colour.
    if (p.highlightHold && word.emphasis && p.highlight === "box") ctx.fillStyle = "#ffffff"
    else if (word.emphasis) ctx.fillStyle = p.emphasisColor
    else if (word.accent) ctx.fillStyle = p.accentColor
    else if (word.serif) ctx.fillStyle = p.serifColor
    else if (p.fill === "texture") {
      // A mottled wash between the two colours, different on every word but the same every frame.
      const wash = ctx.createLinearGradient(-width / 2, -rowSize * 0.8, width / 2, rowSize * 0.1)
      for (let i = 0; i <= 4; i++) wash.addColorStop(i / 4, M.mix(p.color, p.fillColor2, M.noise2(word.index * 1.7, i * 0.9)))
      ctx.fillStyle = wash
      ctx.globalAlpha *= p.fillOpacity
    } else ctx.fillStyle = p.color
    ctx.fillText(word.text, 0, 0)
    ctx.restore()
  })
})`,
}

/*
 * The Modern looks: the same caption with its params set, so people pick them from the Elements
 * tab and add_captions picks them by `look`. Each one loads only the fonts it draws with.
 */

/**
 * Crisp: Montserrat Bold, all lowercase and a little tight, white with the key word in a warm accent,
 * a rare punch word (~word~) in a second one and, for the 3–4 words that carry the idea, a Playfair
 * italic (_word_); a soft shadow and no box. The default for 9:16.
 * The colours are a starting point: pick the two accents from the video.
 */
export const crispCaption: ElementDef = {
  ...kineticCaption,
  id: "crisp-caption",
  name: "Modern · Crisp",
  fonts: ["Montserrat", "Playfair Display"],
  defaultParams: {
    text: "this was *beautiful*",
    font: "Montserrat",
    weight: 700,
    lowercase: true,
    // -0.01 makes long words collide at full size; 0 reads loose.
    tracking: -0.004,
    scale: 0.42,
    color: "#ffffff",
    emphasisFont: "Montserrat",
    emphasisWeight: 700,
    emphasisColor: "#ead9b0",
    emphasisItalic: false,
    emphasisScale: 1.3,
    emphasisFit: true,
    accentFont: "Montserrat",
    accentWeight: 700,
    accentColor: "#ccff00",
    accentItalic: false,
    serifFont: "Playfair Display",
    serifWeight: 700,
    serifColor: "#ccff00",
    serifScale: 1.35,
    highlight: "none",
    animation: "pop",
    shadow: true,
  },
}

/** A faint lead-in line of the lesser words over the key word, set big on a red box. */
export const leadInCaption: ElementDef = {
  ...kineticCaption,
  id: "lead-in-caption",
  name: "Modern · Lead-in",
  fonts: ["Inter Tight", "Instrument Serif"],
  defaultParams: {
    text: "then this *video*",
    arrange: "lead-in",
    leadScale: 0.4,
    leadOpacity: 0.7,
    font: "Inter Tight",
    weight: 800,
    color: "#ffffff",
    emphasisFont: "Inter Tight",
    emphasisWeight: 900,
    emphasisColor: "#ffffff",
    emphasisItalic: false,
    emphasisScale: 1,
    highlight: "box",
    highlightColor: "#e11d2e",
    highlightHold: true,
    accentFont: "Instrument Serif",
    accentWeight: 400,
    accentColor: "#ffffff",
    animation: "blur-rise",
    shadow: true,
  },
}

/** Rounded white words with the key word in purple, a thin line drawing on under it. */
export const accentCaption: ElementDef = {
  ...kineticCaption,
  id: "accent-caption",
  name: "Modern · Accent colour",
  fonts: ["Poppins"],
  defaultParams: {
    text: "this one is *different*",
    font: "Poppins",
    weight: 600,
    color: "#ffffff",
    emphasisFont: "Poppins",
    emphasisWeight: 800,
    emphasisColor: "#8b5cf6",
    emphasisItalic: false,
    emphasisScale: 1,
    highlight: "line",
    highlightColor: "#8b5cf6",
    animation: "blur-rise",
    shadow: true,
  },
}

/** Huge, tight, heavy type that fills the width, in a soft see-through pink wash; the shock word in solid red. */
export const heavyCaption: ElementDef = {
  ...kineticCaption,
  id: "heavy-caption",
  name: "Modern · Heavy fill",
  fonts: ["Inter Tight"],
  defaultParams: {
    text: "stop *scrolling*",
    font: "Inter Tight",
    weight: 900,
    tracking: -0.06,
    fitWidth: true,
    fill: "texture",
    color: "#f2c9cf",
    fillColor2: "#c48b96",
    fillOpacity: 0.85,
    emphasisFont: "Inter Tight",
    emphasisWeight: 900,
    emphasisColor: "#e11d2e",
    emphasisItalic: false,
    emphasisScale: 1,
    animation: "blur-rise",
    shadow: false,
  },
}
