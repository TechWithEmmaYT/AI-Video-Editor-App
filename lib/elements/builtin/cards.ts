import type { ElementDef } from "@/lib/elements/types"

/*
 * Cards: the b-roll you build instead of filming. A talking head cuts to one of these whenever
 * the words name something abstract — a list, a number, a claim — where stock footage says nothing.
 * Each one fills its clip box, so the clip's own animateIn carries it on and off.
 *
 * `bgTo` left empty paints a flat `bg`; set it and the card fills with a gradient instead.
 */

/** The rounded card every element here sits in: gradient or flat, with a soft drop shadow. */
const CARD_BACKDROP = `const r = Math.min(w, h) * (p.radius / 100)
ctx.save()
ctx.shadowColor = "rgba(0, 0, 0, 0.28)"
ctx.shadowBlur = Math.min(w, h) * 0.08
ctx.shadowOffsetY = Math.min(w, h) * 0.03
if (String(p.bgTo).trim()) {
  const fill = ctx.createLinearGradient(0, 0, w, h)
  fill.addColorStop(0, p.bg)
  fill.addColorStop(1, p.bgTo)
  ctx.fillStyle = fill
} else {
  ctx.fillStyle = p.bg
}
ctx.beginPath()
ctx.roundRect(0, 0, w, h, r)
ctx.fill()
ctx.restore()`

export const checklistCard: ElementDef = {
  id: "checklist-card",
  name: "Checklist Card",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 90,
  fonts: ["Inter"],
  paramSchema: [
    { key: "title", label: "Title", type: "text", default: "Blueprint" },
    { key: "items", label: "Items (comma-separated)", type: "text", default: "Content, Distribution, Sales" },
    { key: "stagger", label: "Seconds between items", type: "number", default: 0.45, min: 0.05, max: 3, step: 0.05 },
    { key: "tick", label: "Tick each item", type: "boolean", default: true },
    { key: "font", label: "Font", type: "font", default: "Inter" },
    { key: "accent", label: "Accent", type: "color", default: "#7c3aed" },
    { key: "textColor", label: "Text", type: "color", default: "#1b1333" },
    { key: "bg", label: "Background", type: "color", default: "#ffffff" },
    { key: "bgTo", label: "Background fades to (blank = flat)", type: "color", default: "#efe7ff" },
    { key: "radius", label: "Corner radius (%)", type: "number", default: 8, min: 0, max: 50, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `${CARD_BACKDROP}

const items = String(p.items).split(",").map((s) => s.trim()).filter(Boolean)
const pad = Math.min(w, h) * 0.12
const titleSize = h * 0.14

// Title lands first, then one item every \`stagger\` seconds.
ctx.save()
ctx.globalAlpha = M.clamp(t / 0.25)
ctx.font = M.font(p.font, 800, titleSize)
ctx.fillStyle = p.accent
ctx.textAlign = "left"
ctx.textBaseline = "alphabetic"
ctx.fillText(String(p.title), pad, pad + titleSize * 0.82)
ctx.restore()

const rowSize = h * 0.095
const rowGap = rowSize * 1.9
const firstRow = pad + titleSize * 1.5 + rowSize

items.forEach((item, i) => {
  const k = M.clamp((t - 0.3 - i * p.stagger) / 0.3)
  if (k <= 0) return
  const y = firstRow + rowGap * i
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(pad + (1 - M.ease.outCubic(k)) * rowSize * 0.6, y)

  // The bullet pops a beat after its row arrives, so the tick reads as a separate little event.
  const dot = rowSize * 0.42
  const pop = M.ease.outBack(M.clamp((t - 0.42 - i * p.stagger) / 0.26))
  ctx.save()
  ctx.scale(pop, pop)
  ctx.fillStyle = p.accent
  ctx.beginPath()
  ctx.arc(0, 0, dot, 0, Math.PI * 2)
  ctx.fill()
  if (p.tick) {
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = dot * 0.26
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(-dot * 0.42, 0)
    ctx.lineTo(-dot * 0.1, dot * 0.34)
    ctx.lineTo(dot * 0.45, -dot * 0.36)
    ctx.stroke()
  }
  ctx.restore()

  ctx.font = M.font(p.font, 600, rowSize)
  ctx.fillStyle = p.textColor
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  ctx.fillText(item, dot * 1.9, 0)
  ctx.restore()
})`,
}

export const statCard: ElementDef = {
  id: "stat-card",
  name: "Stat Card",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 70,
  fonts: ["Inter"],
  paramSchema: [
    { key: "value", label: "Big number", type: "text", default: "10K" },
    { key: "label", label: "Label", type: "text", default: "followers" },
    { key: "sublabel", label: "Sub-label", type: "text", default: "in 90 days" },
    { key: "countUp", label: "Count the number up", type: "boolean", default: true },
    { key: "font", label: "Font", type: "font", default: "Inter" },
    { key: "accent", label: "Number colour", type: "color", default: "#ff3b30" },
    { key: "textColor", label: "Text", type: "color", default: "#1b1333" },
    { key: "bg", label: "Background", type: "color", default: "#ffffff" },
    { key: "bgTo", label: "Background fades to (blank = flat)", type: "color", default: "" },
    { key: "radius", label: "Corner radius (%)", type: "number", default: 8, min: 0, max: 50, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `${CARD_BACKDROP}

// "10K" / "$15,000" / "87%" → count the digits up and keep whatever wraps them.
const raw = String(p.value)
const digits = raw.match(/[\\d,.]+/)
const k = M.ease.outCubic(M.clamp(t / 0.7))
let shown = raw
if (p.countUp && digits) {
  const target = parseFloat(digits[0].replace(/,/g, ""))
  if (isFinite(target)) {
    const now = Math.round(target * k)
    shown = raw.replace(digits[0], now.toLocaleString("en-US"))
  }
}

const pad = Math.min(w, h) * 0.12
ctx.textAlign = "center"
ctx.textBaseline = "middle"

const valueSize = h * 0.34
ctx.save()
ctx.globalAlpha = M.clamp(t / 0.2)
const pop = 0.8 + 0.2 * M.ease.outBack(M.clamp(t / 0.4))
ctx.translate(w / 2, h * 0.44)
ctx.scale(pop, pop)
ctx.font = M.font(p.font, 900, valueSize)
ctx.fillStyle = p.accent
ctx.fillText(shown, 0, 0)
ctx.restore()

const labelSize = h * 0.1
ctx.save()
ctx.globalAlpha = M.clamp((t - 0.25) / 0.3)
ctx.font = M.font(p.font, 700, labelSize)
ctx.fillStyle = p.textColor
ctx.fillText(String(p.label), w / 2, h * 0.68)
ctx.restore()

if (String(p.sublabel).trim()) {
  ctx.save()
  ctx.globalAlpha = M.clamp((t - 0.4) / 0.3) * 0.65
  ctx.font = M.font(p.font, 500, labelSize * 0.68)
  ctx.fillStyle = p.textColor
  ctx.fillText(String(p.sublabel), w / 2, h * 0.68 + labelSize * 1.1)
  ctx.restore()
}
void pad`,
}

export const quoteCard: ElementDef = {
  id: "quote-card",
  name: "Quote Card",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 90,
  fonts: ["Inter", "Playfair Display"],
  paramSchema: [
    { key: "quote", label: "Quote", type: "text", default: "You don't need more ideas. You need distribution." },
    { key: "author", label: "Attribution", type: "text", default: "" },
    { key: "font", label: "Font", type: "font", default: "Playfair Display" },
    { key: "weight", label: "Weight", type: "number", default: 700, min: 100, max: 900, step: 100 },
    { key: "italic", label: "Italic", type: "boolean", default: true },
    { key: "textColor", label: "Text", type: "color", default: "#1b1333" },
    { key: "accent", label: "Rule colour", type: "color", default: "#ff3b30" },
    { key: "bg", label: "Background", type: "color", default: "#ffffff" },
    { key: "bgTo", label: "Background fades to (blank = flat)", type: "color", default: "" },
    { key: "radius", label: "Corner radius (%)", type: "number", default: 8, min: 0, max: 50, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `${CARD_BACKDROP}

const pad = Math.min(w, h) * 0.13
const maxWidth = w - pad * 2
const size = h * 0.13
ctx.font = M.font(p.font, p.weight, size, p.italic ? "italic" : "normal")

// Greedy wrap at the card's width.
const rows = []
let row = ""
for (const word of String(p.quote).split(" ").filter(Boolean)) {
  const next = row ? row + " " + word : word
  if (row && ctx.measureText(next).width > maxWidth) { rows.push(row); row = word } else { row = next }
}
if (row) rows.push(row)

ctx.textAlign = "left"
ctx.textBaseline = "middle"
const lineHeight = size * 1.3
const top = h / 2 - (lineHeight * (rows.length - 1)) / 2 - (String(p.author).trim() ? lineHeight * 0.4 : 0)

// A rule draws itself down the left edge as the lines arrive.
const ruleK = M.ease.outCubic(M.clamp(t / 0.5))
ctx.save()
ctx.fillStyle = p.accent
ctx.fillRect(pad * 0.45, top - lineHeight * 0.5, Math.min(w, h) * 0.012, lineHeight * rows.length * ruleK)
ctx.restore()

rows.forEach((text, i) => {
  const k = M.clamp((t - 0.12 - i * 0.12) / 0.32)
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(pad + (1 - M.ease.outCubic(k)) * size * 0.4, top + lineHeight * i)
  ctx.font = M.font(p.font, p.weight, size, p.italic ? "italic" : "normal")
  ctx.fillStyle = p.textColor
  ctx.fillText(text, 0, 0)
  ctx.restore()
})

if (String(p.author).trim()) {
  ctx.save()
  ctx.globalAlpha = M.clamp((t - 0.3 - rows.length * 0.12) / 0.35) * 0.7
  ctx.font = M.font("Inter", 600, size * 0.52)
  ctx.fillStyle = p.textColor
  ctx.fillText("— " + String(p.author), pad, top + lineHeight * rows.length + size * 0.3)
  ctx.restore()
}`,
}

/**
 * A dark list for a reel, in the crisp captions' palette: each item's empty box springs in, then
 * its label slides in after it. Dark on purpose: a white card blows out against dark footage.
 */
export const darkListCard: ElementDef = {
  id: "dark-list-card",
  name: "Dark List Card",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 90,
  fonts: ["Montserrat"],
  paramSchema: [
    { key: "title", label: "Title", type: "text", default: "three things" },
    { key: "items", label: "Items (comma-separated)", type: "text", default: "write, ship, repeat" },
    { key: "stagger", label: "Seconds between items", type: "number", default: 0.5, min: 0.05, max: 3, step: 0.05 },
    { key: "font", label: "Font", type: "font", default: "Montserrat" },
    { key: "bg", label: "Background", type: "color", default: "#0d0d0d" },
    { key: "color", label: "Item colour", type: "color", default: "#ffffff" },
    { key: "accent", label: "Title colour", type: "color", default: "#ead9b0" },
    { key: "line", label: "Line colour", type: "color", default: "#3d3d3d" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const pad = w * 0.085
ctx.fillStyle = p.bg
ctx.fillRect(0, 0, w, h)

const hair = Math.max(1, h * 0.0016)
ctx.strokeStyle = p.line
ctx.lineWidth = hair
ctx.strokeRect(hair / 2, hair / 2, w - hair, h - hair)

ctx.textBaseline = "alphabetic"
ctx.textAlign = "left"

ctx.font = M.font(p.font, 800, h * 0.05)
ctx.fillStyle = p.accent
ctx.globalAlpha = M.clamp(t / 0.25)
ctx.fillText(String(p.title).toLowerCase(), pad, h * 0.16)
ctx.globalAlpha = 1

const items = String(p.items).split(",").map((s) => s.trim()).filter(Boolean)
const itemSize = h * 0.085
const boxSize = itemSize * 0.74
const top = h * 0.33
const gap = (h * 0.52) / Math.max(1, items.length)

items.forEach((label, i) => {
  const start = 0.2 + i * p.stagger
  const kBox = M.clamp((t - start) / 0.3)
  if (kBox <= 0) return
  const kTxt = M.clamp((t - start - 0.08) / 0.34)
  const y = top + gap * i

  const bs = M.ease.outBack(kBox)
  ctx.save()
  ctx.translate(pad + boxSize / 2, y - boxSize * 0.8 + boxSize / 2)
  ctx.scale(bs, bs)
  ctx.globalAlpha = M.clamp(kBox * 2)
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, h * 0.0045)
  M.roundRect(ctx, -boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.2)
  ctx.stroke()
  ctx.restore()

  if (kTxt > 0) {
    const e = M.ease.outCubic(kTxt)
    ctx.globalAlpha = e
    ctx.font = M.font(p.font, 800, itemSize)
    ctx.fillStyle = p.color
    ctx.fillText(label.toLowerCase(), pad + boxSize * 1.6 - (1 - e) * w * 0.05, y)
    ctx.globalAlpha = 1
  }
})`,
}
