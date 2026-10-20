import type { ElementDef } from "@/lib/elements/types"

export const arrowPointer: ElementDef = {
  id: "arrow-pointer",
  name: "Arrow Pointer",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 90,
  fonts: ["Caveat"],
  paramSchema: [
    { key: "color", label: "Colour", type: "color", default: "#f2622e" },
    { key: "label", label: "Label", type: "text", default: "Look here" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = M.ease.outCubic(M.clamp(t / 0.7))
const x0 = w * 0.1
const y0 = h * 0.82
const cx = w * 0.22
const cy = h * 0.12
const x1 = w * 0.88
const y1 = h * 0.2
const steps = 60
const done = Math.round(steps * k)
ctx.strokeStyle = p.color
ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.035)
ctx.lineCap = "round"
ctx.lineJoin = "round"
ctx.beginPath()
ctx.moveTo(x0, y0)
let px = x0
let py = y0
for (let i = 1; i <= done; i++) {
  const s = i / steps
  px = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * cx + s * s * x1
  py = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * cy + s * s * y1
  ctx.lineTo(px, py)
}
ctx.stroke()
if (done > 1) {
  const s = done / steps
  const angle = Math.atan2(2 * (1 - s) * (cy - y0) + 2 * s * (y1 - cy), 2 * (1 - s) * (cx - x0) + 2 * s * (x1 - cx))
  const head = ctx.lineWidth * 3
  ctx.beginPath()
  ctx.moveTo(px - head * Math.cos(angle - 0.5), py - head * Math.sin(angle - 0.5))
  ctx.lineTo(px, py)
  ctx.lineTo(px - head * Math.cos(angle + 0.5), py - head * Math.sin(angle + 0.5))
  ctx.stroke()
}
if (p.label) {
  ctx.globalAlpha = M.clamp((t - 0.4) / 0.3)
  ctx.fillStyle = p.color
  ctx.font = M.font("Caveat", 700, h * 0.16)
  ctx.textBaseline = "top"
  ctx.fillText(p.label, x0, y0 + h * 0.03)
}`,
}

export const highlightBox: ElementDef = {
  id: "highlight-box",
  name: "Highlight Box",
  category: "callouts",
  layout: "callout",
  defaultDurationInFrames: 90,
  fonts: [],
  paramSchema: [{ key: "color", label: "Colour", type: "color", default: "#facc15" }],
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = M.ease.inOutCubic(M.clamp(t / 0.8))
const lw = Math.max(3, Math.min(w, h) * 0.03)
const r = Math.min(w, h) * 0.12
const around = 2 * (w + h)
ctx.lineWidth = lw
ctx.strokeStyle = p.color
ctx.setLineDash([around * k, around])
M.roundRect(ctx, lw, lw, w - lw * 2, h - lw * 2, r)
ctx.stroke()
ctx.setLineDash([])
ctx.fillStyle = M.alpha(p.color, (0.1 + 0.05 * Math.sin(t * 4)) * k)
ctx.fill()`,
}

export const badgePop: ElementDef = {
  id: "badge-pop",
  name: "Badge Pop",
  category: "callouts",
  layout: "square",
  defaultDurationInFrames: 90,
  fonts: ["Bricolage Grotesque"],
  paramSchema: [
    { key: "text", label: "Text", type: "text", default: "NEW" },
    { key: "color", label: "Text colour", type: "color", default: "#18181b" },
    { key: "background", label: "Badge", type: "color", default: "#facc15" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = Math.max(0, M.spring(M.clamp(t / 1), { damping: 6, frequency: 1.5 }))
const s = Math.min(w, h)
const spikes = 16
ctx.translate(w / 2, h / 2)
ctx.scale(k, k)
ctx.save()
ctx.rotate(t * 0.4)
ctx.beginPath()
for (let i = 0; i < spikes * 2; i++) {
  const r = i % 2 ? s * 0.4 : s * 0.48
  const a = (i / (spikes * 2)) * Math.PI * 2
  if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a))
  else ctx.lineTo(r * Math.cos(a), r * Math.sin(a))
}
ctx.closePath()
ctx.fillStyle = p.background
ctx.fill()
ctx.restore()
ctx.fillStyle = p.color
ctx.textAlign = "center"
ctx.textBaseline = "middle"
ctx.font = M.font("Bricolage Grotesque", 800, s * 0.2)
M.fitText(ctx, p.text, s * 0.6, s * 0.2)
ctx.fillText(p.text, 0, s * 0.01)`,
}
