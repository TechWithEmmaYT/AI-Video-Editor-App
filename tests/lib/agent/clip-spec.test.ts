import { describe, expect, it } from "vitest"

import { addClipOps, addClipSchema, updateClipOps } from "@/lib/agent/clip-spec"
import { findBuiltinElement } from "@/lib/elements/builtin"
import { applyOps } from "@/lib/project/ops"
import { docSchema, type CodeClip, type TextClip, type VideoClip } from "@/lib/project/schema"
import { idSequence, imageClip, project } from "@/tests/fixtures"

const size = { width: 1080, height: 1920 }
const video = { id: "m1", kind: "video" as const, name: "talk.mp4", url: "https://ik.imagekit.io/demo/talk.mp4", thumbnailUrl: null, width: 1080, height: 1920, durationSec: 60 }

function add(state: ReturnType<typeof project>, clip: unknown, extra: Partial<Parameters<typeof addClipOps>[2]> = {}) {
  const spec = addClipSchema.parse(clip)
  const { ops, clipId } = addClipOps(state, spec, { ...size, newId: idSequence(), ...extra })
  const next = applyOps(state, ops)
  expect(docSchema.safeParse(next.doc).success).toBe(true)
  return { next, clip: next.doc.clips.find((c) => c.id === clipId)! }
}

describe("add_clip", () => {
  it("adds a trimmed media clip in seconds, capped to what's left of the source", () => {
    const { clip } = add(project({}, 30), { kind: "media", mediaId: "m1", at: 2, trimStart: 50, duration: 20, volume: 0 }, { media: video })
    expect(clip).toMatchObject({ type: "video", from: 60, trimStartFrames: 1500, durationInFrames: 300, volume: 0, radius: 0 })
  })

  it("puts a text clip with a preset on the top free track, with overrides and a box", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c", trackId: "t1", from: 0, durationInFrames: 300 })] })
    const { next, clip } = add(state, { kind: "text", text: "Hello", at: 1, preset: "caption", color: "#ff0000", box: { y: 100 } })
    expect(next.doc.tracks[0].id).not.toBe("t1") // t1 was busy → a new top track
    expect(clip as TextClip).toMatchObject({ type: "text", text: "Hello", color: "#ff0000", from: 30 })
    expect(clip.transform.y).toBe(100)
  })

  it("adds an element with param overrides", () => {
    const { clip } = add(project(), { kind: "element", elementId: "kinetic-caption", at: 0, params: { text: "so *good*", times: "0, 0.3" } }, { element: findBuiltinElement("kinetic-caption") })
    expect((clip as CodeClip).params).toMatchObject({ text: "so *good*", times: "0, 0.3", font: "Inter" })
    expect((clip as CodeClip).elementId).toBe("kinetic-caption")
  })

  it("refuses a busy explicit track and unknown media", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c", trackId: "t1", from: 0, durationInFrames: 300 })] })
    expect(() => addClipOps(state, addClipSchema.parse({ kind: "text", text: "x", at: 1, track: "t1" }), { ...size, newId: idSequence() })).toThrow(/already has a clip/)
    expect(() => addClipOps(state, addClipSchema.parse({ kind: "media", mediaId: "nope", at: 0 }), { ...size, newId: idSequence(), media: null })).toThrow(/list_media/)
  })
})

describe("update_clip", () => {
  it("converts seconds to frames and merges the box", () => {
    const clip = imageClip({ id: "c", trackId: "t1" })
    expect(updateClipOps(clip, { at: 2, duration: 1.5, box: { x: 10 } })).toEqual([
      { type: "updateClip", clipId: "c", patch: { from: 60, durationInFrames: 45, transform: { x: 10 } } },
    ])
  })

  it("merges code params and rejects params on other clips", () => {
    const code = { ...imageClip({ id: "k", trackId: "t1" }), type: "code", code: "ctx.fill()", params: { a: 1, b: 2 }, paramSchema: [], fonts: [], radius: 0 } as unknown as CodeClip
    expect(updateClipOps(code, { params: { b: 3 } })[0]).toMatchObject({ patch: { params: { a: 1, b: 3 } } })
    expect(() => updateClipOps(imageClip({ id: "c", trackId: "t1" }), { params: { x: 1 } })).toThrow(/code clips/)
    expect(() => updateClipOps(imageClip({ id: "c", trackId: "t1" }), {})).toThrow(/Nothing to change/)
  })

  it("lets video clips get a radius (b-roll cards)", () => {
    const state = project({ tracks: [{ id: "t1" }] }, 300)
    const { next, clip } = add(state, { kind: "media", mediaId: "m1", at: 0, duration: 2 }, { media: video })
    const after = applyOps(next, updateClipOps(clip, { radius: 40 }))
    expect((after.doc.clips[0] as VideoClip).radius).toBe(40)
  })
})
