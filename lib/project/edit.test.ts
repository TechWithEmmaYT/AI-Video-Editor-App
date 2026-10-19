import { describe, expect, it } from "vitest"

import { duplicateClipOps, splitClipOps } from "@/lib/project/edit"
import { applyOps } from "@/lib/project/ops"
import { docSchema, type AudioClip } from "@/lib/project/schema"
import { idSequence, imageClip, project } from "@/lib/project/test-fixtures"

const audio: AudioClip = {
  id: "a1",
  trackId: "t1",
  type: "audio",
  name: "Song",
  color: "audio",
  from: 30,
  durationInFrames: 90,
  transform: { x: 0, y: 0, width: 1920, height: 1080, scale: 1, rotation: 0, opacity: 1 },
  mediaId: "m1",
  src: "https://ik.imagekit.io/demo/song.mp3",
  trimStartFrames: 15,
  sourceDurationInFrames: 300,
  volume: 1,
  fadeInFrames: 10,
  fadeOutFrames: 20,
}

describe("splitClipOps", () => {
  it("splits media so the second half continues where the first stopped", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [audio] })
    const result = splitClipOps(state, "a1", 60, idSequence())!
    const next = applyOps(state, result.ops)
    expect(docSchema.safeParse(next.doc).success).toBe(true)

    const [first, second] = next.doc.clips as AudioClip[]
    expect(first).toMatchObject({ from: 30, durationInFrames: 30, trimStartFrames: 15, fadeInFrames: 10, fadeOutFrames: 0 })
    expect(second).toMatchObject({ from: 60, durationInFrames: 60, trimStartFrames: 45, fadeInFrames: 0, fadeOutFrames: 20 })
  })

  it("refuses to split at or outside the clip's edges", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [audio] })
    expect(splitClipOps(state, "a1", 30, idSequence())).toBeNull()
    expect(splitClipOps(state, "a1", 120, idSequence())).toBeNull()
    expect(splitClipOps(state, "nope", 60, idSequence())).toBeNull()
  })
})

describe("duplicateClipOps", () => {
  it("places the copy right after the original when there's room", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c1", trackId: "t1" })] })
    const result = duplicateClipOps(state, "c1", idSequence())!
    const next = applyOps(state, result.ops)
    expect(next.doc.clips[1]).toMatchObject({ trackId: "t1", from: 30, name: "Still copy" })
  })

  it("uses a new track above when the spot after is taken", () => {
    const state = project({
      tracks: [{ id: "t1" }],
      clips: [imageClip({ id: "c1", trackId: "t1" }), imageClip({ id: "c2", trackId: "t1", from: 30 })],
    })
    const result = duplicateClipOps(state, "c1", idSequence())!
    const next = applyOps(state, result.ops)
    expect(docSchema.safeParse(next.doc).success).toBe(true)
    expect(next.doc.tracks.map((t) => t.id)).toEqual(["id-1", "t1"])
    expect(next.doc.clips.at(-1)).toMatchObject({ trackId: "id-1", from: 0 })
  })
})
