import { describe, expect, it } from "vitest"

import { BRIEFS, findBrief } from "@/lib/agent/briefs"
import { findBuiltinElement } from "@/lib/elements/builtin"
import { findFont } from "@/lib/fonts"

describe("briefs", () => {
  it.each(BRIEFS.map((b) => [b.name, b] as const))("%s only names elements and fonts that exist", (_, brief) => {
    expect(new Set(BRIEFS.map((b) => b.id)).size).toBe(BRIEFS.length)
    for (const id of brief.elements) expect(findBuiltinElement(id), id).toBeDefined()
    // Every element named in the body by its display name exists too.
    for (const id of brief.elements) expect(brief.body).toContain(findBuiltinElement(id)!.name)
    for (const family of ["Inter", "Playfair Display", "Inter Tight", "Poppins", "Instrument Serif"]) {
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

describe("Modern reel briefs", () => {
  it.each([
    ["lead-in-reel", "lead-in-caption", "lead-in"],
    ["accent-reel", "accent-caption", "accent"],
    ["heavy-fill-reel", "heavy-caption", "heavy-fill"],
  ])("%s captions with its own element and add_captions look, and points to references", (briefId, elementId, look) => {
    const brief = findBrief(briefId)!
    expect(brief.elements[0]).toBe(elementId)
    expect(brief.body).toContain(`look: "${look}"`)
    expect(brief.body).not.toContain("Kinetic Caption")
    expect(brief.body).toContain("https://www.pinterest.com/pin/1073123417590337055/")
    expect(brief.body).toContain("https://www.pinterest.com/search/pins/?q=reel%20short&rs=typed")
  })

  it("come first in the list, before the classic looks", () => {
    expect(BRIEFS.slice(0, 3).map((b) => b.id)).toEqual(["lead-in-reel", "accent-reel", "heavy-fill-reel"])
  })
})

describe("talking-head briefs", () => {
  it("share the same rules and differ only in their numbers", () => {
    const reel = findBrief("reel-captions")!
    const long = findBrief("long-form")!
    for (const brief of [reel, long]) {
      expect(brief.body).toContain("volume: 0")
      expect(brief.body).toContain("clip.from + round(sourceSeconds × fps) − clip.trimStartFrames")
      expect(brief.body).toContain("Solid Colour")
    }
    expect(reel.body).toContain("1–4 words")
    expect(long.body).toContain("3–7 words")
    expect(long.body).toContain("Bar Lower Third")
    expect(reel.formats).toEqual(["9:16"])
    expect(long.formats).toEqual(["16:9"])
  })
})
