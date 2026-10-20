import { describe, expect, it } from "vitest"

import { compileCode } from "@/lib/code-clips/compile"
import { createHelpers } from "@/lib/code-clips/helpers"
import { resolveParams } from "@/lib/code-clips/params"
import { validateCode } from "@/lib/code-clips/validate"
import { BUILTIN_ELEMENTS } from "@/lib/elements/builtin"
import { planElementAdd } from "@/lib/elements/place"
import { findFont } from "@/lib/fonts"
import { FORMATS } from "@/lib/project/formats"
import { applyOps } from "@/lib/project/ops"
import { docSchema } from "@/lib/project/schema"
import { idSequence, project } from "@/lib/project/test-fixtures"

/** A stand-in 2D context: records nothing, but answers what drawing code reads. */
function fakeContext() {
  const state: Record<string, unknown> = { font: "10px sans-serif" }
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key as string]
      if (key === "measureText") return (text: string) => ({ width: String(text).length * 10 })
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => ({ addColorStop() {} })
      return () => undefined
    },
    set(target, key, value) {
      target[key as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

describe("built-in elements", () => {
  it("has the plan's 15 elements plus Kinetic Caption and Solid Colour, with unique ids", () => {
    expect(BUILTIN_ELEMENTS).toHaveLength(17)
    expect(new Set(BUILTIN_ELEMENTS.map((e) => e.id)).size).toBe(17)
  })

  it.each(BUILTIN_ELEMENTS.map((e) => [e.name, e] as const))("%s passes the validator and draws without errors", (_, element) => {
    expect(validateCode(element.code)).toBeNull()
    element.fonts.forEach((family) => expect(findFont(family), family).toBeDefined())

    const compiled = compileCode(element.code)
    if (!compiled.ok) throw new Error(compiled.error.message)
    const p = resolveParams(element.paramSchema, element.defaultParams)
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const M = createHelpers(() => {})
      expect(() => compiled.draw({ ctx: fakeContext(), t: u * 3, u, w: 1600, h: 400, p, M })).not.toThrow()
    }
  })

  it.each(BUILTIN_ELEMENTS.map((e) => [e.name, e] as const))("%s makes a valid clip in every format", (_, element) => {
    for (const format of Object.values(FORMATS)) {
      const state = project()
      const result = planElementAdd(state, element, { frame: 0, target: null, fps: 30, width: format.width, height: format.height, newId: idSequence() })
      expect(docSchema.safeParse(applyOps(state, result.ops).doc).success).toBe(true)
    }
  })
})
