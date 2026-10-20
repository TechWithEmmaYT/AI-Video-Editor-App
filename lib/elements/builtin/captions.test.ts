import { describe, expect, it } from "vitest"

import { compileCode } from "@/lib/code-clips/compile"
import { createHelpers } from "@/lib/code-clips/helpers"
import { resolveParams } from "@/lib/code-clips/params"
import { kineticCaption } from "@/lib/elements/builtin/captions"

/** Draws one frame and returns the words drawn, with the colour and font each was drawn in. */
function drawnAt(t: number, u: number, params: Record<string, unknown>) {
  const compiled = compileCode(kineticCaption.code)
  if (!compiled.ok) throw new Error(compiled.error.message)
  const drawn: { text: string; color: string; font: string }[] = []
  const state: Record<string, unknown> = { font: "10px sans-serif", fillStyle: "#000" }
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key as string]
      if (key === "measureText") return (text: string) => ({ width: String(text).length * 10 })
      if (key === "fillText") return (text: string) => drawn.push({ text, color: String(state.fillStyle), font: String(state.font) })
      return () => undefined
    },
    set(target, key, value) {
      target[key as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  const p = resolveParams(kineticCaption.paramSchema, params)
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
