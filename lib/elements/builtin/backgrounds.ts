import type { ElementDef } from "@/lib/elements/types"

export const gradientMesh: ElementDef = {
  id: "gradient-mesh",
  name: "Gradient Mesh",
  category: "backgrounds",
  layout: "full",
  defaultDurationInFrames: 150,
  fonts: [],
  paramSchema: [
    { key: "base", label: "Base", type: "color", default: "#0b0b12" },
    { key: "color1", label: "Colour 1", type: "color", default: "#f2622e" },
    { key: "color2", label: "Colour 2", type: "color", default: "#8b5cf6" },
    { key: "color3", label: "Colour 3", type: "color", default: "#3b82f6" },
    { key: "speed", label: "Speed", type: "number", default: 0.6, min: 0, max: 3, step: 0.1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `ctx.fillStyle = p.base
ctx.fillRect(0, 0, w, h)
const colors = [p.color1, p.color2, p.color3]
colors.forEach((color, i) => {
  const a = t * p.speed + i * 2.1
  const x = w * (0.5 + 0.35 * Math.cos(a * 0.7 + i))
  const y = h * (0.5 + 0.35 * Math.sin(a * 0.9 + i * 1.7))
  const r = Math.max(w, h) * 0.55
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, M.alpha(color, 0.85))
  g.addColorStop(1, M.alpha(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})`,
}

export const dotGrid: ElementDef = {
  id: "dot-grid",
  name: "Dot Grid",
  category: "backgrounds",
  layout: "full",
  defaultDurationInFrames: 150,
  fonts: [],
  paramSchema: [
    { key: "background", label: "Background", type: "color", default: "#0f0f12" },
    { key: "color", label: "Dots", type: "color", default: "#f2622e" },
    { key: "spacing", label: "Spacing", type: "number", default: 44, min: 12, max: 200, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `ctx.fillStyle = p.background
ctx.fillRect(0, 0, w, h)
const gap = Math.max(12, p.spacing * Math.max(w, h) / 1920)
ctx.fillStyle = p.color
for (let y = gap / 2; y < h; y += gap) {
  for (let x = gap / 2; x < w; x += gap) {
    const d = Math.hypot(x - w / 2, y - h / 2) / Math.max(w, h)
    const s = 0.5 + 0.5 * Math.sin(d * 18 - t * 3)
    ctx.globalAlpha = 0.2 + 0.8 * s
    ctx.beginPath()
    ctx.arc(x, y, gap * 0.12 * (0.6 + s), 0, Math.PI * 2)
    ctx.fill()
  }
}`,
}

export const noiseWaves: ElementDef = {
  id: "noise-waves",
  name: "Noise Waves",
  category: "backgrounds",
  layout: "full",
  defaultDurationInFrames: 150,
  fonts: [],
  paramSchema: [
    { key: "background", label: "Background", type: "color", default: "#09090b" },
    { key: "color1", label: "Top colour", type: "color", default: "#3b82f6" },
    { key: "color2", label: "Bottom colour", type: "color", default: "#f2622e" },
    { key: "lines", label: "Lines", type: "number", default: 18, min: 4, max: 60, step: 1 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `ctx.fillStyle = p.background
ctx.fillRect(0, 0, w, h)
const lines = Math.round(p.lines)
ctx.lineWidth = Math.max(1, h * 0.004)
for (let i = 0; i < lines; i++) {
  const y0 = (h / (lines + 1)) * (i + 1)
  ctx.strokeStyle = M.mix(p.color1, p.color2, i / Math.max(1, lines - 1))
  ctx.beginPath()
  for (let step = 0; step <= 120; step++) {
    const x = (w * step) / 120
    const n = M.noise2(x / (w * 0.25) + t * 0.4, i * 0.6 + t * 0.2)
    const y = y0 + (n - 0.5) * h * 0.25
    if (step === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}`,
}

/** A plain colour over the whole canvas: e.g. black behind a b-roll card while the speaker's audio keeps playing. */
export const solidColour: ElementDef = {
  id: "solid-colour",
  name: "Solid Colour",
  category: "backgrounds",
  layout: "full",
  defaultDurationInFrames: 90,
  fonts: [],
  paramSchema: [{ key: "color", label: "Colour", type: "color", default: "#000000" }],
  defaultParams: {},
  createdBy: "builtin",
  code: `ctx.fillStyle = p.color
ctx.fillRect(0, 0, w, h)`,
}
