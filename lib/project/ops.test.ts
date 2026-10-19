import { describe, expect, it } from "vitest"

import { applyOps, applyWithInverse, OpError, opsSchema, withDurationFit, withEmptyTrackCleanup, type Op } from "@/lib/project/ops"
import { docSchema } from "@/lib/project/schema"
import { imageClip, project } from "@/lib/project/test-fixtures"

const base = project({
  tracks: [{ id: "t1" }, { id: "t2" }],
  clips: [imageClip({ id: "c1", trackId: "t1" }), imageClip({ id: "c2", trackId: "t2", from: 60 })],
  sections: [{ id: "s1", name: "Intro", from: 0, to: 30, color: "purple" }],
})

describe("applyOps", () => {
  it("adds a track at an index (0 = top)", () => {
    const next = applyOps(base, [{ type: "addTrack", track: { id: "t0" }, index: 0 }])
    expect(next.doc.tracks.map((t) => t.id)).toEqual(["t0", "t1", "t2"])
  })

  it("clamps an addTrack index past the end", () => {
    const next = applyOps(base, [{ type: "addTrack", track: { id: "t9" }, index: 99 }])
    expect(next.doc.tracks.at(-1)?.id).toBe("t9")
  })

  it("refuses to remove a track that still has clips", () => {
    expect(() => applyOps(base, [{ type: "removeTrack", trackId: "t1" }])).toThrow(OpError)
  })

  it("merges a transform patch one level deep", () => {
    const next = applyOps(base, [{ type: "updateClip", clipId: "c1", patch: { transform: { x: 50 } } }])
    const clip = next.doc.clips.find((c) => c.id === "c1")!
    expect(clip.transform).toMatchObject({ x: 50, y: 0, width: 1920, opacity: 1 })
  })

  it("updates project name and length", () => {
    const next = applyOps(base, [{ type: "updateProject", patch: { name: "Renamed", durationInFrames: 900 } }])
    expect(next).toMatchObject({ name: "Renamed", durationInFrames: 900 })
  })

  it("never mutates the input state", () => {
    const snapshot = structuredClone(base)
    applyOps(base, [{ type: "removeClip", clipId: "c1" }])
    expect(base).toEqual(snapshot)
  })

  it("throws on unknown ids", () => {
    expect(() => applyOps(base, [{ type: "removeClip", clipId: "nope" }])).toThrow(OpError)
  })
})

describe("applyWithInverse", () => {
  const cases: [string, Op[]][] = [
    ["addTrack", [{ type: "addTrack", track: { id: "t3" }, index: 1 }]],
    ["updateClip move", [{ type: "updateClip", clipId: "c2", patch: { trackId: "t1", from: 90 } }]],
    ["updateClip transform", [{ type: "updateClip", clipId: "c1", patch: { transform: { x: 10, opacity: 0.5 } } }]],
    ["removeClip", [{ type: "removeClip", clipId: "c1" }]],
    ["addClip", [{ type: "addClip", clip: imageClip({ id: "c3", trackId: "t1", from: 100 }) }]],
    ["sections", [{ type: "updateSection", sectionId: "s1", patch: { name: "Hook", to: 45 } }]],
    ["removeSection", [{ type: "removeSection", sectionId: "s1" }]],
    ["updateProject", [{ type: "updateProject", patch: { durationInFrames: 600 } }]],
    [
      "split-style batch",
      [
        { type: "updateClip", clipId: "c1", patch: { durationInFrames: 10 } },
        { type: "addClip", clip: imageClip({ id: "c1b", trackId: "t1", from: 10, durationInFrames: 20 }) },
      ],
    ],
  ]

  it.each(cases)("%s round-trips through its inverse", (_, ops) => {
    const { state, inverse } = applyWithInverse(base, ops)
    expect(state).not.toEqual(base)
    expect(applyOps(state, inverse)).toEqual(base)
  })
})

describe("withEmptyTrackCleanup", () => {
  it("removes a track emptied by the batch", () => {
    const ops = withEmptyTrackCleanup(base, [{ type: "updateClip", clipId: "c2", patch: { trackId: "t1", from: 60 } }])
    expect(ops.at(-1)).toEqual({ type: "removeTrack", trackId: "t2" })
    expect(applyOps(base, ops).doc.tracks.map((t) => t.id)).toEqual(["t1"])
  })

  it("leaves new empty tracks alone", () => {
    const ops: Op[] = [{ type: "addTrack", track: { id: "t3" }, index: 0 }]
    expect(withEmptyTrackCleanup(base, ops)).toEqual(ops)
  })
})

describe("withDurationFit", () => {
  it("fits the project to where the last clip ends, shrinking or growing", () => {
    const shrink = withDurationFit(base, [{ type: "updateClip", clipId: "c2", patch: { from: 0 } }])
    expect(applyOps(base, shrink).durationInFrames).toBe(30)
    const grow = withDurationFit(base, [{ type: "updateClip", clipId: "c2", patch: { from: 600 } }])
    expect(applyOps(base, grow).durationInFrames).toBe(630)
  })

  it("keeps the length when the last clip is removed", () => {
    const ops: Op[] = [{ type: "removeClip", clipId: "c1" }, { type: "removeClip", clipId: "c2" }]
    expect(withDurationFit(base, ops)).toEqual(ops)
  })
})

describe("schemas", () => {
  it("rejects a patch that changes a clip id", () => {
    const bad = [{ type: "updateClip", clipId: "c1", patch: { id: "other" } }]
    expect(opsSchema.safeParse(bad).success).toBe(false)
  })

  it("rejects overlapping clips on one track", () => {
    const next = applyOps(base, [{ type: "updateClip", clipId: "c2", patch: { trackId: "t1", from: 10 } }])
    expect(docSchema.safeParse(next.doc).success).toBe(false)
  })

  it("accepts the fixture doc", () => {
    expect(docSchema.safeParse(base.doc).success).toBe(true)
  })
})
