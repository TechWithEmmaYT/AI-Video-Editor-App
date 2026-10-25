import { describe, expect, it } from "vitest"

import { findFont } from "@/lib/fonts"
import { FORMATS } from "@/lib/project/formats"
import { applyOps } from "@/lib/project/ops"
import { CLIP_MOTION_DEFAULTS, docSchema, type AudioClip } from "@/lib/project/schema"
import { planTextAdd, TEXT_PRESETS } from "@/lib/project/text-presets"
import { idSequence, imageClip, project } from "@/tests/fixtures"

const size = { fps: 30, width: 1920, height: 1080 }

const audio = (id: string, trackId: string): AudioClip => ({
  ...CLIP_MOTION_DEFAULTS,
  id,
  trackId,
  type: "audio",
  name: "Song",
  color: "audio",
  from: 0,
  durationInFrames: 300,
  transform: { x: 0, y: 0, width: 1920, height: 1080, scale: 1, rotation: 0, opacity: 1 },
  mediaId: "m",
  src: "https://ik.imagekit.io/demo/song.mp3",
  trimStartFrames: 0,
  sourceDurationInFrames: null,
  volume: 1,
  fadeInFrames: 0,
  fadeOutFrames: 0,
})

describe("text presets", () => {
  it("every preset makes a valid clip in every format, in a font the editor can load", () => {
    for (const preset of TEXT_PRESETS) {
      expect(findFont(preset.fontFamily), preset.fontFamily).toBeDefined()
      for (const format of Object.values(FORMATS)) {
        const state = project()
        const result = planTextAdd(state, preset.id, { ...size, width: format.width, height: format.height, frame: 0, target: null, newId: idSequence() })!
        expect(docSchema.safeParse(applyOps(state, result.ops).doc).success).toBe(true)
      }
    }
  })

  it("a click adds at the frame on the top free track", () => {
    const state = project({
      tracks: [{ id: "t1" }, { id: "t2" }],
      clips: [imageClip({ id: "c1", trackId: "t1", from: 0, durationInFrames: 60 }), imageClip({ id: "c2", trackId: "t2", from: 200 })],
    })
    const next = applyOps(state, planTextAdd(state, "title", { ...size, frame: 30, target: null, newId: idSequence() })!.ops)
    const text = next.doc.clips.find((clip) => clip.type === "text")!
    expect(text).toMatchObject({ trackId: "t2", from: 30, durationInFrames: 90 })
  })

  it("a click with no free track adds a new top track, never below the audio", () => {
    const state = project({
      tracks: [{ id: "t1" }, { id: "a1" }],
      clips: [imageClip({ id: "c1", trackId: "t1", from: 0, durationInFrames: 300 }), audio("s1", "a1")],
    })
    const next = applyOps(state, planTextAdd(state, "caption", { ...size, frame: 0, target: null, newId: idSequence() })!.ops)
    expect(next.doc.tracks.map((track) => track.id)).toEqual(["id-1", "t1", "a1"])
  })

  it("a drop on a track uses that track", () => {
    const state = project({ tracks: [{ id: "t1" }, { id: "t2" }], clips: [imageClip({ id: "c1", trackId: "t2", from: 0 })] })
    const result = planTextAdd(state, "label", { ...size, frame: 0, target: { kind: "track", trackId: "t1" }, newId: idSequence() })!
    expect(applyOps(state, result.ops).doc.clips.find((clip) => clip.id === result.clipId)?.trackId).toBe("t1")
  })
})
