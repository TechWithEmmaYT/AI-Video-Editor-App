import { describe, expect, it } from "vitest"

import { applyOps, opsSchema } from "@/lib/project/ops"
import { sampleClipOps } from "@/lib/project/sample"
import { docSchema } from "@/lib/project/schema"
import { idSequence, project } from "@/lib/project/test-fixtures"

describe("sampleClipOps", () => {
  it("builds a valid 15-second layout on an empty project", () => {
    const state = project({}, 150)
    const ops = sampleClipOps(state, { fps: 30, width: 1920, height: 1080, newId: idSequence() })
    expect(opsSchema.safeParse(ops).success).toBe(true)

    const next = applyOps(state, ops)
    expect(docSchema.safeParse(next.doc).success).toBe(true)
    expect(next.doc.tracks).toHaveLength(4)
    expect(next.doc.sections).toHaveLength(6)
    expect(next.durationInFrames).toBe(450)
  })
})
