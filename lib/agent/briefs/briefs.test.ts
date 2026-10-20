import { describe, expect, it } from "vitest"

import { BRIEFS } from "@/lib/agent/briefs"
import { findBuiltinElement } from "@/lib/elements/builtin"
import { findFont } from "@/lib/fonts"

describe("briefs", () => {
  it.each(BRIEFS.map((b) => [b.name, b] as const))("%s only names elements and fonts that exist", (_, brief) => {
    expect(new Set(BRIEFS.map((b) => b.id)).size).toBe(BRIEFS.length)
    for (const id of brief.elements) expect(findBuiltinElement(id), id).toBeDefined()
    // Every element named in the body by its display name exists too.
    for (const id of brief.elements) expect(brief.body).toContain(findBuiltinElement(id)!.name)
    for (const family of ["Inter", "Playfair Display"]) {
      if (brief.body.includes(family)) expect(findFont(family), family).toBeDefined()
    }
  })

  it("reel captions matches the Kinetic Caption element's defaults", () => {
    const caption = findBuiltinElement("kinetic-caption")!
    const defaults = Object.fromEntries(caption.paramSchema.map((p) => [p.key, p.default]))
    expect(defaults).toMatchObject({ font: "Inter", weight: 900, emphasisFont: "Playfair Display", emphasisColor: "#ff3b30", emphasisItalic: true })
    expect(caption.layout).toBe("caption")
  })
})
