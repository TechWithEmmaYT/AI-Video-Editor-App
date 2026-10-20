import { describe, expect, it } from "vitest"

import { changeFormatOps, clearTimelineOps, duplicateClipOps, replaceSourceOps, splitClipOps } from "@/lib/project/edit"
import { applyOps, applyWithInverse, withEmptyTrackCleanup } from "@/lib/project/ops"
import { docSchema, type AudioClip } from "@/lib/project/schema"
import { idSequence, imageClip, project } from "@/tests/fixtures"

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

describe("replaceSourceOps", () => {
  const media = { id: "m2", kind: "audio" as const, name: "New song", url: "https://ik.imagekit.io/demo/new.mp3", durationSec: 2 }

  it("swaps the file, restarts it and shortens the clip to fit the new file", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [audio] })
    const next = applyOps(state, replaceSourceOps(audio, media, 30)!)
    expect(docSchema.safeParse(next.doc).success).toBe(true)
    expect(next.doc.clips[0]).toMatchObject({
      mediaId: "m2",
      src: media.url,
      name: "New song",
      from: 30,
      trimStartFrames: 0,
      sourceDurationInFrames: 60,
      durationInFrames: 60,
      volume: 1,
      fadeInFrames: 10,
    })
  })

  it("keeps the length when the new file is long enough", () => {
    const ops = replaceSourceOps(audio, { ...media, durationSec: 60 }, 30)!
    expect(ops[0]).toMatchObject({ patch: { sourceDurationInFrames: 1800 } })
    expect((ops[0] as { patch: object }).patch).not.toHaveProperty("durationInFrames")
  })

  it("refuses a different kind or the same file", () => {
    expect(replaceSourceOps(audio, { ...media, kind: "video" }, 30)).toBeNull()
    expect(replaceSourceOps(audio, { ...media, id: "m1" }, 30)).toBeNull()
  })
})

describe("changeFormatOps", () => {
  it("refits clips to the new canvas, as one batch that undoes exactly", () => {
    const full = imageClip({ id: "bg", trackId: "t1" }) // 1920×1080 at 0,0
    const card = imageClip({ id: "card", trackId: "t2", transform: { x: 1500, y: 100, width: 300, height: 200, scale: 1, rotation: 0, opacity: 1 } })
    const state = project({ tracks: [{ id: "t1" }, { id: "t2" }], clips: [full, card] })

    const { state: next, inverse } = applyWithInverse(state, changeFormatOps(state, "9:16")!)
    expect(next.format).toBe("9:16")
    expect(next.doc.clips[0].transform).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920 })
    // Same size, centre at the same relative spot (1650/1920 across, 200/1080 down).
    expect(next.doc.clips[1].transform).toMatchObject({ width: 300, height: 200, x: Math.round(928.125 - 150), y: Math.round(355.56 - 100) })
    expect(docSchema.safeParse(next.doc).success).toBe(true)

    expect(applyOps(next, inverse)).toEqual(state)
  })

  it("shrinks a box (and its text) that's wider than the new canvas", () => {
    const text = {
      id: "t", trackId: "t1", type: "text" as const, name: "Title", from: 0, durationInFrames: 30,
      transform: { x: 154, y: 400, width: 1612, height: 280, scale: 1, rotation: 0, opacity: 1 },
      text: "Hi", fontFamily: "Inter", fontWeight: 800, fontSize: 120, color: "#fff", align: "center" as const, letterSpacing: -2, lineHeight: 1,
    }
    const state = project({ tracks: [{ id: "t1" }], clips: [text] })
    const next = applyOps(state, changeFormatOps(state, "9:16")!)
    const clip = next.doc.clips[0] as typeof text
    expect(clip.transform.width).toBe(1080)
    expect(clip.fontSize).toBe(Math.round(120 * (1080 / 1612)))
  })

  it("is null for the same format", () => {
    expect(changeFormatOps(project(), "16:9")).toBeNull()
  })
})

describe("clearTimelineOps", () => {
  it("removes everything in one batch that undoes exactly", () => {
    const state = project({
      tracks: [{ id: "t1" }, { id: "t2" }],
      clips: [imageClip({ id: "a", trackId: "t1" }), imageClip({ id: "b", trackId: "t2", from: 60 })],
      sections: [{ id: "s1", name: "Intro", from: 0, to: 30, color: "#8b5cf6" }],
    })
    const { state: cleared, inverse } = applyWithInverse(state, withEmptyTrackCleanup(state, clearTimelineOps(state)!))
    expect(cleared.doc).toEqual({ tracks: [], clips: [], sections: [] })
    expect(applyOps(cleared, inverse)).toEqual(state)
  })

  it("is null on an empty timeline", () => {
    expect(clearTimelineOps(project())).toBeNull()
  })
})
