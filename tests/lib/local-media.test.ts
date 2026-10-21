import { describe, expect, it } from "vitest"

import { pickEvictions, type LocalEntry } from "@/lib/local-media"

const MB = 1024 * 1024

function entry(id: string, sizeMb: number, usedAt: number): LocalEntry {
  return { id, size: sizeMb * MB, usedAt }
}

describe("pickEvictions", () => {
  it("evicts nothing under the cap", () => {
    expect(pickEvictions([entry("a", 10, 1), entry("b", 10, 2)], 30 * MB, new Set())).toEqual([])
  })

  it("evicts the least recently used until the total fits", () => {
    const entries = [entry("new", 10, 5), entry("old", 10, 1), entry("mid", 10, 3)]
    expect(pickEvictions(entries, 15 * MB, new Set())).toEqual(["old", "mid"])
  })

  it("never evicts a kept file, even an old one", () => {
    const entries = [entry("open", 10, 1), entry("other", 10, 2), entry("new", 10, 3)]
    expect(pickEvictions(entries, 20 * MB, new Set(["open", "new"]))).toEqual(["other"])
  })

  it("stops when only kept files are left over the cap", () => {
    expect(pickEvictions([entry("a", 30, 1)], 20 * MB, new Set(["a"]))).toEqual([])
  })
})
