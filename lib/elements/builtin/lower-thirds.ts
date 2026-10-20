import type { ElementDef } from "@/lib/elements/types"

export const barLowerThird: ElementDef = {
  id: "bar-lower-third",
  name: "Bar Lower Third",
  category: "lower-thirds",
  layout: "lower-third",
  defaultDurationInFrames: 150,
  fonts: ["Inter"],
  paramSchema: [
    { key: "name", label: "Name", type: "text", default: "Alex Rivera" },
    { key: "role", label: "Role", type: "text", default: "Founder, motion" },
    { key: "color", label: "Text", type: "color", default: "#ffffff" },
    { key: "background", label: "Bar", type: "color", default: "#18181b" },
    { key: "accent", label: "Accent", type: "color", default: "#f2622e" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const k = M.ease.outCubic(M.clamp(t / 0.5))
const out = M.ease.in(M.clamp((u - 0.88) / 0.12))
const reach = w * k * (1 - out)
const stripe = h * 0.08
ctx.fillStyle = p.accent
ctx.fillRect(0, 0, Math.min(reach, stripe), h)
ctx.fillStyle = M.alpha(p.background, 0.92)
ctx.fillRect(stripe, 0, Math.max(0, reach - stripe), h)
ctx.beginPath()
ctx.rect(0, 0, reach, h)
ctx.clip()
ctx.fillStyle = p.color
ctx.textBaseline = "alphabetic"
ctx.font = M.font("Inter", 700, h * 0.34)
M.fitText(ctx, p.name, w - h * 0.5, h * 0.34)
ctx.fillText(p.name, h * 0.3, h * 0.5)
ctx.globalAlpha = 0.72
ctx.font = M.font("Inter", 500, h * 0.21)
ctx.fillText(p.role, h * 0.3, h * 0.82)`,
}

export const pillNameTag: ElementDef = {
  id: "pill-name-tag",
  name: "Pill Name Tag",
  category: "lower-thirds",
  layout: "lower-third",
  defaultDurationInFrames: 150,
  fonts: ["Inter"],
  paramSchema: [
    { key: "name", label: "Name", type: "text", default: "Sam Lee" },
    { key: "color", label: "Text", type: "color", default: "#ffffff" },
    { key: "background", label: "Pill", type: "color", default: "#27272a" },
    { key: "accent", label: "Avatar", type: "color", default: "#8b5cf6" },
  ],
  defaultParams: {},
  createdBy: "builtin",
  code: `const pill = Math.min(h, w * 0.3) * 0.7
const k = M.ease.outBack(M.clamp(t / 0.6))
const out = M.clamp((u - 0.9) / 0.1)
ctx.font = M.font("Inter", 700, pill * 0.3)
const nameW = ctx.measureText(String(p.name)).width
const width = Math.min(w, pill * 1.15 + nameW + pill * 0.45)
ctx.globalAlpha = 1 - out
ctx.translate(0, (h - pill) / 2)
ctx.translate(pill / 2, pill / 2)
ctx.scale(k, k)
ctx.translate(-pill / 2, -pill / 2)
ctx.fillStyle = p.background
M.roundRect(ctx, 0, 0, width, pill, pill / 2)
ctx.fill()
ctx.fillStyle = p.accent
ctx.beginPath()
ctx.arc(pill / 2, pill / 2, pill * 0.36, 0, Math.PI * 2)
ctx.fill()
ctx.fillStyle = "#ffffff"
ctx.textAlign = "center"
ctx.textBaseline = "middle"
ctx.font = M.font("Inter", 800, pill * 0.34)
ctx.fillText(String(p.name).charAt(0).toUpperCase(), pill / 2, pill * 0.52)
ctx.textAlign = "left"
ctx.fillStyle = p.color
ctx.font = M.font("Inter", 700, pill * 0.3)
ctx.fillText(p.name, pill * 1.05, pill / 2)`,
}
