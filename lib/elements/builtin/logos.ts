import type { ElementDef } from "@/lib/elements/types"

const SAMPLE_LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="#f2622e"/><circle cx="36" cy="50" r="12" fill="#fff"/><circle cx="64" cy="50" r="12" fill="#fff"/></svg>'

export const svgLogoReveal: ElementDef = {
  id: "svg-logo-reveal",
  name: "SVG Logo Reveal",
  category: "logos",
  layout: "square",
  defaultDurationInFrames: 90,
  fonts: [],
  paramSchema: [
    { key: "svg", label: "SVG markup", type: "text", default: SAMPLE_LOGO },
    { key: "accent", label: "Ring", type: "color", default: "#f2622e" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const img = M.svg(p.svg)
const k = M.ease.outCubic(M.clamp(t / 0.8))
const s = Math.min(w, h)
ctx.save()
ctx.beginPath()
ctx.arc(w / 2, h / 2, s * 0.75 * k, 0, Math.PI * 2)
ctx.clip()
if (img) {
  const size = s * (0.62 + 0.08 * k)
  ctx.drawImage(img, (w - size) / 2, (h - size) / 2, size, size)
}
ctx.restore()
ctx.strokeStyle = p.accent
ctx.lineWidth = s * 0.02
ctx.globalAlpha = 1 - k
ctx.beginPath()
ctx.arc(w / 2, h / 2, s * 0.45 * (0.6 + k * 0.6), 0, Math.PI * 2)
ctx.stroke()`,
}

export const logoSpin: ElementDef = {
  id: "logo-spin",
  name: "Logo Spin",
  category: "logos",
  layout: "square",
  defaultDurationInFrames: 90,
  fonts: ["Fredoka"],
  paramSchema: [
    { key: "image", label: "Logo image", type: "image", default: "" },
    { key: "letter", label: "Letter (no image)", type: "text", default: "m" },
    { key: "color", label: "Colour", type: "color", default: "#f2622e" },
    { key: "turns", label: "Turns", type: "number", default: 1, min: 0, max: 5, step: 0.25 },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const grow = M.ease.outBack(M.clamp(t / 0.8))
const spin = 1 - M.ease.outCubic(M.clamp(t / 0.8))
const s = Math.min(w, h) * 0.7 * grow
ctx.translate(w / 2, h / 2)
ctx.rotate(spin * Math.PI * 2 * p.turns)
const img = p.image ? M.image(p.image) : null
if (img) {
  ctx.drawImage(img, -s / 2, -s / 2, s, s)
} else {
  ctx.fillStyle = p.color
  M.roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.24)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = M.font("Fredoka", 700, Math.max(1, s * 0.55))
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(p.letter).slice(0, 2), 0, s * 0.04)
}`,
}
