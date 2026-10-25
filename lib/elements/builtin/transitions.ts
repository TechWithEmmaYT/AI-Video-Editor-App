import type { ElementDef } from "@/lib/elements/types"

export const wipe: ElementDef = {
  id: "wipe",
  name: "Wipe",
  category: "transitions",
  layout: "full",
  defaultDurationInFrames: 30,
  fonts: [],
  paramSchema: [
    { key: "color", label: "Colour", type: "color", default: "#f2622e" },
    { key: "angle", label: "Angle (°)", type: "number", default: 0, min: -180, max: 180, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `// First half covers the screen, second half uncovers it.
const k = M.ease.inOutCubic(u)
const d = Math.hypot(w, h)
ctx.translate(w / 2, h / 2)
ctx.rotate((p.angle * Math.PI) / 180)
const from = k < 0.5 ? -d / 2 : -d / 2 + (k - 0.5) * 2 * d
const to = k < 0.5 ? -d / 2 + k * 2 * d : d / 2
ctx.fillStyle = p.color
ctx.fillRect(from, -d / 2, Math.max(0, to - from), d)`,
}

export const circleReveal: ElementDef = {
  id: "circle-reveal",
  name: "Circle Reveal",
  category: "transitions",
  layout: "full",
  defaultDurationInFrames: 30,
  fonts: [],
  paramSchema: [{ key: "color", label: "Colour", type: "color", default: "#0b0b12" }],
  defaultParams: {},
  createdBy: "builtin",
  code: `// A circle grows to cover the screen, then a hole grows to reveal what's next.
const r = (Math.hypot(w, h) / 2) * M.ease.inOutCubic(u < 0.5 ? u * 2 : (u - 0.5) * 2)
ctx.fillStyle = p.color
ctx.beginPath()
if (u < 0.5) {
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fill()
} else {
  ctx.rect(0, 0, w, h)
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
  ctx.fill("evenodd")
}`,
}

/**
 * A colour floods the screen, then a rounded card grows out of the middle of it and takes over —
 * the cut a talking head makes into a built graphic, instead of a hard cut.
 */
export const shapeGrow: ElementDef = {
  id: "shape-grow",
  name: "Shape Grow",
  category: "transitions",
  layout: "full",
  defaultDurationInFrames: 24,
  fonts: [],
  paramSchema: [
    { key: "color", label: "Flood colour", type: "color", default: "#7c3aed" },
    { key: "shapeColor", label: "Card colour", type: "color", default: "#ffffff" },
    { key: "radius", label: "Card corner radius", type: "number", default: 48, min: 0, max: 400, step: 4 },
    { key: "hold", label: "Flood holds until", type: "number", default: 0.45, min: 0.1, max: 0.9, step: 0.05 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `// Up to \`hold\` the flood wipes across; after it, the card grows from a pill to the full frame.
if (u < p.hold) {
  const k = M.ease.outQuint(u / p.hold)
  ctx.fillStyle = p.color
  ctx.fillRect(0, h / 2 - (h / 2) * k, w, h * k)
  return
}

ctx.fillStyle = p.color
ctx.fillRect(0, 0, w, h)

const k = M.ease.inOutCubic((u - p.hold) / (1 - p.hold))
// Starts as a small pill in the middle and ends covering the frame.
const cw = w * (0.22 + 0.78 * k)
const ch = h * (0.07 + 0.93 * k)
ctx.fillStyle = p.shapeColor
ctx.beginPath()
ctx.roundRect((w - cw) / 2, (h - ch) / 2, cw, ch, p.radius * (1 - k * 0.7))
ctx.fill()`,
}

const SHUTTER_PARAMS: ElementDef["paramSchema"] = [
  { key: "color", label: "Blade colour", type: "color", default: "#000000" },
  { key: "accent", label: "Edge line colour", type: "color", default: "#ccff00" },
  { key: "flashColor", label: "Flash colour", type: "color", default: "#ffffff" },
  { key: "flashOpacity", label: "Flash strength", type: "number", default: 0.45, min: 0, max: 1, step: 0.05 },
]

/** Opens a reel at 0:00: two blades start shut and snap apart, with one bright blink. */
export const shutterOpen: ElementDef = {
  id: "shutter-open",
  name: "Shutter Open",
  category: "transitions",
  layout: "full",
  defaultDurationInFrames: 14,
  fonts: [],
  paramSchema: SHUTTER_PARAMS,
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = 1 - M.ease.outCubic(M.clamp(u / 0.8))
const half = (h / 2) * k
ctx.fillStyle = p.color
ctx.fillRect(0, 0, w, half)
ctx.fillRect(0, h - half, w, half)
if (half > 1) {
  const lw = Math.max(2, h * 0.0035)
  ctx.fillStyle = p.accent
  ctx.fillRect(0, half - lw, w, lw)
  ctx.fillRect(0, h - half, w, lw)
}
const flash = 1 - M.clamp(u / 0.12)
if (flash > 0) {
  ctx.fillStyle = M.alpha(p.flashColor, M.ease.outCubic(flash) * p.flashOpacity)
  ctx.fillRect(0, 0, w, h)
}`,
}

/**
 * Hides a cut: the blades slam shut at the midpoint, flash, and snap open. Start it 0.18 s before
 * the cut so it is fully shut on the cut itself.
 */
export const shutterCut: ElementDef = {
  id: "shutter-cut",
  name: "Shutter Cut",
  category: "transitions",
  layout: "full",
  defaultDurationInFrames: 11,
  fonts: [],
  paramSchema: SHUTTER_PARAMS,
  defaultParams: {},
  createdBy: "builtin",
  code: `const close = M.clamp(u / 0.5)
const open = M.clamp((u - 0.5) / 0.5)
const k = u < 0.5 ? M.ease.inCubic(close) : 1 - M.ease.outCubic(open)
const half = (h / 2) * k
ctx.fillStyle = p.color
ctx.fillRect(0, 0, w, half)
ctx.fillRect(0, h - half, w, half)
if (half > 1) {
  const lw = Math.max(2, h * 0.0035)
  ctx.fillStyle = p.accent
  ctx.fillRect(0, half - lw, w, lw)
  ctx.fillRect(0, h - half, w, lw)
}
const flash = 1 - M.clamp(Math.abs(u - 0.5) / 0.14)
if (flash > 0) {
  ctx.fillStyle = M.alpha(p.flashColor, M.ease.outCubic(flash) * p.flashOpacity)
  ctx.fillRect(0, 0, w, h)
}`,
}
