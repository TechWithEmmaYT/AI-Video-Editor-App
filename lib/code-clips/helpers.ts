import { requestImage, requestSvg } from "@/lib/code-clips/assets"
import { fontStack } from "@/lib/fonts"

/*
 * `M`, the helpers code clips get (see the plan, §7). Frozen and null-prototype, so code can't
 * change them or reach Object.prototype through them. Everything is deterministic: no
 * Math.random, so a frame always draws the same way in the editor and the export.
 */

// ── Math ────────────────────────────────────────────────────────────────

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
/** Maps v from [inA, inB] to [outA, outB], clamped unless `clampIt` is false. */
const map = (v: number, inA: number, inB: number, outA = 0, outB = 1, clampIt = true) => {
  const k = inB === inA ? 0 : (v - inA) / (inB - inA)
  return lerp(outA, outB, clampIt ? clamp(k) : k)
}

const c1 = 1.70158
const c3 = c1 + 1
const ease = Object.freeze({
  linear: (k: number) => k,
  in: (k: number) => k * k,
  out: (k: number) => 1 - (1 - k) * (1 - k),
  inOut: (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  inCubic: (k: number) => k ** 3,
  outCubic: (k: number) => 1 - (1 - k) ** 3,
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outQuint: (k: number) => 1 - (1 - k) ** 5,
  inOutQuint: (k: number) => (k < 0.5 ? 16 * k ** 5 : 1 - (-2 * k + 2) ** 5 / 2),
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutExpo: (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2),
  outBack: (k: number) => 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2,
  inOutBack: (k: number) =>
    k < 0.5 ? ((2 * k) ** 2 * ((c1 * 1.525 + 1) * 2 * k - c1 * 1.525)) / 2 : ((2 * k - 2) ** 2 * ((c1 * 1.525 + 1) * (k * 2 - 2) + c1 * 1.525) + 2) / 2,
  outElastic: (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 2 ** (-10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  outBounce: (k: number) => {
    const n = 7.5625
    const d = 2.75
    if (k < 1 / d) return n * k * k
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375
    return n * (k -= 2.625 / d) * k + 0.984375
  },
})

/** A springy 0 → 1 (overshoots, then settles). `damping` higher = settles sooner; `frequency` = wobbles. */
const spring = (u: number, opts?: { damping?: number; frequency?: number }) => {
  if (u <= 0) return 0
  const damping = opts?.damping ?? 6
  const frequency = opts?.frequency ?? 1.6
  return 1 - Math.exp(-damping * u) * Math.cos(2 * Math.PI * frequency * u)
}

/** A repeatable random number in [0, 1) for a seed. */
const rand = (seed: number) => {
  let x = Math.imul((seed * 2654435761) | 0, 1597334677) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 2246822519) >>> 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

/** Smooth 2D value noise in [0, 1]. */
const noise2 = (x: number, y: number) => {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const corner = (cx: number, cy: number) => rand(cx * 374761393 + cy * 668265263)
  const sx = xf * xf * (3 - 2 * xf)
  const sy = yf * yf * (3 - 2 * yf)
  return lerp(lerp(corner(xi, yi), corner(xi + 1, yi), sx), lerp(corner(xi, yi + 1), corner(xi + 1, yi + 1), sx), sy)
}

// ── Colour ──────────────────────────────────────────────────────────────

type RGBA = [number, number, number, number]

function parseColor(color: string): RGBA {
  const value = String(color).trim()
  let hex = /^#([0-9a-f]{3,8})$/i.exec(value)?.[1]
  if (hex) {
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("")
    const n = (i: number) => parseInt(hex!.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), hex.length === 8 ? n(6) / 255 : 1]
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value)?.[1]
  if (rgb) {
    const [r, g, b, a = "1"] = rgb.split(/[\s,/]+/).filter(Boolean)
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  return [0, 0, 0, 1]
}

const rgba = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`

/** Blends two colours: k = 0 gives c1, 1 gives c2. */
const mix = (colorA: string, colorB: string, k: number) => {
  const a = parseColor(colorA)
  const b = parseColor(colorB)
  return rgba([0, 1, 2, 3].map((i) => lerp(a[i], b[i], clamp(k))) as RGBA)
}

/** The colour at opacity `a`. */
const alpha = (color: string, a: number) => {
  const [r, g, b] = parseColor(color)
  return rgba([r, g, b, clamp(a)])
}

// ── Drawing ─────────────────────────────────────────────────────────────

/** Adds a rounded rectangle to the current path (call ctx.fill()/stroke() after). */
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 0) => {
  const radius = clamp(r, 0, Math.min(Math.abs(w), Math.abs(h)) / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** A CSS font string: ctx.font = M.font("Inter", 700, 64). */
const font = (family: string, weight = 400, size = 32) => `${weight} ${size}px ${fontStack(family)}`

/** Shrinks ctx.font (from `size` down) until `text` fits in maxW. Sets it and returns the size used. */
const fitText = (ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number) => {
  const withSize = (s: number) => (/\d*\.?\d+px/.test(ctx.font) ? ctx.font.replace(/\d*\.?\d+px/, `${s}px`) : `${s}px sans-serif`)
  ctx.font = withSize(size)
  const width = ctx.measureText(String(text)).width
  const fitted = width > maxW && width > 0 ? Math.max(1, Math.floor((size * maxW) / width)) : size
  ctx.font = withSize(fitted)
  return fitted
}

const paths = new Map<string, Path2D>()

/** SVG path data as a Path2D (cached). */
const path = (d: string) => {
  let cached = paths.get(d)
  if (!cached) {
    if (paths.size > 200) paths.clear()
    cached = new Path2D(String(d))
    paths.set(d, cached)
  }
  return cached
}

/**
 * The helpers for one frame. `track` collects loads still in flight (images, SVGs) so the
 * runtime can redraw when they land, and hold an export frame until they do.
 */
export function createHelpers(track: (pending: Promise<unknown>) => void) {
  const helpers = Object.assign(Object.create(null), {
    lerp,
    clamp,
    map,
    ease,
    spring,
    rand,
    noise2,
    roundRect,
    fitText,
    font,
    mix,
    alpha,
    path,
    image: (url: string) => requestImage(String(url), track),
    svg: (markup: string) => requestSvg(String(markup), track),
  })
  return Object.freeze(helpers)
}

/** For tests and previews that only need the pure helpers. */
export const pureHelpers = { lerp, clamp, map, ease, spring, rand, noise2, mix, alpha }
