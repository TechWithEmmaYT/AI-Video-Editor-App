import { describe, expect, it } from "vitest"

import { compileCode } from "@/lib/code-clips/compile"
import { createHelpers } from "@/lib/code-clips/helpers"
import { resolveParams } from "@/lib/code-clips/params"
import { accentCaption, crispCaption, heavyCaption, kineticCaption, leadInCaption } from "@/lib/elements/builtin/captions"
import type { ElementDef } from "@/lib/elements/types"

/** Draws one frame and returns the words drawn, with the colour, font, opacity and filter each was drawn in. */
function drawnAt(t: number, u: number, params: Record<string, unknown>, element: ElementDef = kineticCaption) {
  const compiled = compileCode(element.code)
  if (!compiled.ok) throw new Error(compiled.error.message)
  const drawn: { text: string; color: string; font: string; alpha: number; filter: string; spacing: string }[] = []
  const state: Record<string, unknown> = { font: "10px sans-serif", fillStyle: "#000", globalAlpha: 1, filter: "none", letterSpacing: "0px" }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key as string]
      if (key === "measureText") return (text: string) => ({ width: String(text).length * 10 })
      if (key === "fillText") {
        return (text: string) =>
          drawn.push({ text, color: String(state.fillStyle), font: String(state.font), alpha: Number(state.globalAlpha), filter: String(state.filter), spacing: String(state.letterSpacing) })
      }
      if (key === "createLinearGradient") return () => ({ addColorStop() {}, toString: () => "gradient" })
      return () => undefined
    },
    set(target, key, value) {
      target[key as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  const p = resolveParams(element.paramSchema, { ...element.defaultParams, ...params })
  compiled.draw({ ctx, t, u, w: 950, h: 216, p, M: createHelpers(() => {}) })
  return drawn
}

describe("Kinetic Caption", () => {
  const params = { text: "make it *move*", times: "0, 0.3, 0.6" }

  it("shows each word from its time in the transcript", () => {
    expect(drawnAt(0.1, 0.07, params).map((w) => w.text)).toEqual(["make"])
    expect(drawnAt(0.4, 0.27, params).map((w) => w.text)).toEqual(["make", "it"])
    expect(drawnAt(0.8, 0.53, params).map((w) => w.text)).toEqual(["make", "it", "move"])
  })

  it("draws the *emphasis* word in its own colour and italic font", () => {
    const words = drawnAt(1, 0.66, params)
    expect(words[0]).toMatchObject({ color: "#ffffff" })
    expect(words[2].color).toBe("#ff3b30")
    expect(words[2].font).toMatch(/^italic 700 .*Playfair Display/)
  })

  it("spreads the words over the clip when there are no times", () => {
    // 1.5 s clip: words at 0, 0.3 and 0.6 s (60% of the clip, evenly).
    expect(drawnAt(0.35, 0.35 / 1.5, { text: "one two three" }).map((w) => w.text)).toEqual(["one", "two"])
  })
})

/** The px size in a ctx.font string. */
const sizeOf = (font: string) => Number(/([\d.]+)px/.exec(font)?.[1])

describe("Modern caption looks", () => {
  it("lead-in sets the lesser words small and faint above the key word", () => {
    const words = drawnAt(2, 0.9, { text: "then this *video*", times: "0, 0.2, 0.4" }, leadInCaption)
    expect(words.map((w) => w.text)).toEqual(["then", "this", "video"])
    expect(sizeOf(words[0].font) / sizeOf(words[2].font)).toBeCloseTo(0.4)
    expect(words[0].alpha).toBeCloseTo(0.7)
    expect(words[2]).toMatchObject({ color: "#ffffff", alpha: 1 })
    expect(words[2].font).toMatch(/^900 .*Inter Tight/)
  })

  it("lead-in sets a ~word~ big in the italic accent font", () => {
    const words = drawnAt(2, 0.9, { text: "made for ~you~", times: "0, 0.2, 0.4" }, leadInCaption)
    expect(words[2].font).toMatch(/^italic 400 .*Instrument Serif/)
    expect(sizeOf(words[2].font)).toBeGreaterThan(sizeOf(words[0].font) * 2)
  })

  it("blur-rise fades each word up out of a blur", () => {
    const params = { text: "this one is *different*", times: "0, 0.2, 0.4, 0.6" }
    const early = drawnAt(0.05, 0.03, params, accentCaption)
    expect(early).toHaveLength(1)
    expect(early[0].filter).toMatch(/^blur\(/)
    expect(drawnAt(2, 0.9, params, accentCaption)[0].filter).toBe("none")
  })

  it("accent colour draws the key word bolder in purple", () => {
    const words = drawnAt(2, 0.9, { text: "this one is *different*", times: "0, 0.2, 0.4, 0.6" }, accentCaption)
    expect(words[0]).toMatchObject({ color: "#ffffff" })
    expect(words[0].font).toMatch(/^600 .*Poppins/)
    expect(words[3]).toMatchObject({ color: "#8b5cf6" })
    expect(words[3].font).toMatch(/^800 .*Poppins/)
  })

  it("heavy fill washes the words in a see-through texture, tightly set, with the shock word in solid red", () => {
    const words = drawnAt(2, 0.9, { text: "stop *scrolling*", times: "0, 0.3" }, heavyCaption)
    expect(words[0]).toMatchObject({ color: "gradient", alpha: 0.85 })
    expect(parseFloat(words[0].spacing)).toBeCloseTo(-0.06 * sizeOf(words[0].font))
    expect(words[1]).toMatchObject({ color: "#e11d2e", alpha: 1 })
  })

  it("leaves the Kinetic Caption's own look as it was", () => {
    const words = drawnAt(1, 0.66, { text: "make it *move*", times: "0, 0.3, 0.6" })
    expect(words.map((w) => [w.alpha, w.filter, w.spacing])).toEqual([[1, "none", "0px"], [1, "none", "0px"], [1, "none", "0px"]])
  })
})

describe("Modern · Crisp", () => {
  it("is lowercase Montserrat 700, with the key word in the warm accent and the punch word in lime", () => {
    const words = drawnAt(2, 0.9, { text: "This is *Huge* ~now~", times: "0, 0.2, 0.4, 0.6" }, crispCaption)
    expect(words.map((w) => w.text)).toEqual(["this", "is", "huge", "now"])
    expect(words[0]).toMatchObject({ color: "#ffffff" })
    expect(words[0].font).toMatch(/^normal 700 .*Montserrat/)
    expect(words[2].color).toBe("#ead9b0")
    expect(words[3].color).toBe("#ccff00")
    expect(words[3].font).toMatch(/^normal 700 /)
  })

  it("grows a long key word less, so it stays inside the frame", () => {
    const at = (word: string) => {
      const words = drawnAt(2, 0.9, { text: `so *${word}*`, times: "0, 0.2" }, crispCaption)
      return sizeOf(words[1].font) / sizeOf(words[0].font)
    }
    expect(at("short")).toBeCloseTo(1.3)
    expect(at("complete")).toBeCloseTo(1.15)
    expect(at("opportunity.")).toBeCloseTo(1)
  })

  it("draws a _serif_ word in lime Playfair Display italic, a little larger", () => {
    const words = drawnAt(2, 0.9, { text: "the _future_ is here", times: "0, 0.2, 0.4, 0.6" }, crispCaption)
    expect(words[1].text).toBe("future")
    expect(words[1].color).toBe("#ccff00")
    expect(words[1].font).toMatch(/^italic 700 .*Playfair Display/)
    expect(sizeOf(words[1].font) / sizeOf(words[0].font)).toBeCloseTo(1.35)
  })
})
