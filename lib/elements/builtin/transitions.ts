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
