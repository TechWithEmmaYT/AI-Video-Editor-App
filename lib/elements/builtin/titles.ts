import type { ElementDef } from "@/lib/elements/types"

// Code bodies run as function (ctx, t, u, w, h, p, M) — see lib/code-clips/validate.ts.

export const bigTitle: ElementDef = {
  id: "big-title",
  name: "Big Title",
  category: "titles",
  layout: "title",
  defaultDurationInFrames: 90,
  fonts: ["Bricolage Grotesque"],
  paramSchema: [
    { key: "text", label: "Text", type: "text", default: "Big idea" },
    { key: "color", label: "Colour", type: "color", default: "#ffffff" },
    { key: "accent", label: "Accent", type: "color", default: "#f2622e" },
    { key: "font", label: "Font", type: "font", default: "Bricolage Grotesque" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = M.ease.outCubic(M.clamp(t / 0.6))
const out = M.clamp((u - 0.85) / 0.15)
const size = Math.min(h * 0.62, w * 0.16)
ctx.font = M.font(p.font, 800, size)
M.fitText(ctx, p.text, w * 0.94, size)
ctx.textAlign = "center"
ctx.textBaseline = "middle"
ctx.globalAlpha = k * (1 - out)
ctx.fillStyle = p.color
ctx.fillText(p.text, w / 2, h * 0.45 + (1 - k) * h * 0.25)
const bar = w * 0.18 * M.ease.outCubic(M.clamp((t - 0.25) / 0.5))
ctx.fillStyle = p.accent
M.roundRect(ctx, (w - bar) / 2, h * 0.86, bar, h * 0.05, h * 0.025)
ctx.fill()`,
}

export const kineticWords: ElementDef = {
  id: "kinetic-words",
  name: "Kinetic Words",
  category: "titles",
  layout: "title",
  defaultDurationInFrames: 120,
  fonts: ["Bricolage Grotesque"],
  paramSchema: [
    { key: "text", label: "Text", type: "text", default: "Say it with motion" },
    { key: "color", label: "Colour", type: "color", default: "#ffffff" },
    { key: "accent", label: "Accent", type: "color", default: "#f2622e" },
    { key: "stagger", label: "Stagger (s)", type: "number", default: 0.18, min: 0.05, max: 1, step: 0.01 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const words = String(p.text).split(" ").filter(Boolean)
const size = Math.min(h * 0.5, w * 0.12)
ctx.font = M.font("Bricolage Grotesque", 800, size)
ctx.textAlign = "center"
ctx.textBaseline = "middle"
const gap = size * 0.28
const widths = words.map((word) => ctx.measureText(word).width)
const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, words.length - 1)
const fit = total > w * 0.94 ? (w * 0.94) / total : 1
const out = M.clamp((u - 0.88) / 0.12)
ctx.translate(w / 2, h / 2)
ctx.scale(fit, fit)
let x = -total / 2
words.forEach((word, i) => {
  const k = M.clamp((t - i * p.stagger) / 0.35)
  ctx.save()
  ctx.translate(x + widths[i] / 2, (1 - M.ease.outBack(k)) * size * 0.6)
  ctx.globalAlpha = M.clamp(k * 3) * (1 - out)
  ctx.fillStyle = i % 2 ? p.accent : p.color
  ctx.fillText(word, 0, 0)
  ctx.restore()
  x += widths[i] + gap
})`,
}

export const typewriter: ElementDef = {
  id: "typewriter",
  name: "Typewriter",
  category: "titles",
  layout: "title",
  defaultDurationInFrames: 120,
  fonts: ["JetBrains Mono"],
  paramSchema: [
    { key: "text", label: "Text", type: "text", default: "npm run motion" },
    { key: "color", label: "Colour", type: "color", default: "#ffffff" },
    { key: "accent", label: "Cursor", type: "color", default: "#f2622e" },
    { key: "seconds", label: "Typing time (s)", type: "number", default: 1.6, min: 0.2, max: 10, step: 0.1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const text = String(p.text)
const shown = Math.floor(M.clamp(t / p.seconds) * text.length)
const size = M.clamp(Math.min(h * 0.4, w * 0.07), 8, 400)
ctx.font = M.font("JetBrains Mono", 600, size)
const fitted = M.fitText(ctx, text, w * 0.92, size)
ctx.textBaseline = "middle"
ctx.fillStyle = p.color
const visible = text.slice(0, shown)
const x = (w - ctx.measureText(text).width) / 2
ctx.fillText(visible, x, h / 2)
if (shown < text.length || Math.floor(t * 2) % 2 === 0) {
  ctx.fillStyle = p.accent
  ctx.fillRect(x + ctx.measureText(visible).width + fitted * 0.08, h / 2 - fitted * 0.5, fitted * 0.1, fitted)
}`,
}
