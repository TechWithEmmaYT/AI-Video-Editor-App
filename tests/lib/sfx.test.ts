import { existsSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { SOUND_EFFECTS } from "@/lib/sfx"

describe("sound effects", () => {
  it("each has a unique id and a file in public/sfx", () => {
    expect(new Set(SOUND_EFFECTS.map((effect) => effect.id)).size).toBe(SOUND_EFFECTS.length)
    for (const effect of SOUND_EFFECTS) expect(existsSync(path.join(process.cwd(), "public", "sfx", effect.file)), effect.file).toBe(true)
  })
})
