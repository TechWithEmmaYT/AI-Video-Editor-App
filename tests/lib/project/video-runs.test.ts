import { describe, expect, it } from "vitest"

import type { Clip, VideoClip } from "@/lib/project/schema"
import { clipAt, groupVideoRuns } from "@/lib/project/video-runs"
import { imageClip } from "@/tests/fixtures"

const video = (id: string, from: number, duration: number, trim: number, overrides: Partial<VideoClip> = {}): VideoClip => ({
  id,
  trackId: "t1",
  type: "video",
  name: "talk.mp4",
  color: "video",
  from,
  durationInFrames: duration,
  transform: { x: 0, y: 0, width: 1080, height: 1920, scale: 1, rotation: 0, opacity: 1 },
  mediaId: "m1",
  src: "https://ik.imagekit.io/demo/talk.mp4",
  trimStartFrames: trim,
  sourceDurationInFrames: 420,
  volume: 0,
  fit: "cover",
  radius: 0,
  ...overrides,
})

const shape = (clips: Clip[]) => groupVideoRuns(clips).map((item) => (item.type === "clip" ? item.clip.id : item.clips.map((c) => c.id)))

describe("groupVideoRuns", () => {
  it("joins pieces that play one file continuously (a punch-in done as many short clips)", () => {
    const pieces = [video("a", 0, 3, 0), video("b", 3, 3, 3, { transform: { x: 0, y: 0, width: 1100, height: 1950, scale: 1, rotation: 0, opacity: 1 } }), video("c", 6, 3, 6)]
    expect(shape(pieces)).toEqual([["a", "b", "c"]])
  })

  it("breaks a run at a gap, a jump in the source, another file or another track", () => {
    expect(shape([video("a", 0, 3, 0), video("b", 4, 3, 4)])).toEqual(["a", "b"]) // gap on the timeline
    expect(shape([video("a", 0, 3, 0), video("b", 3, 3, 30)])).toEqual(["a", "b"]) // jump cut in the source
    expect(shape([video("a", 0, 3, 0), video("b", 3, 3, 3, { mediaId: "m2", src: "https://ik.imagekit.io/demo/b.mp4" })])).toEqual(["a", "b"])
    expect(shape([video("a", 0, 3, 0), video("b", 3, 3, 3, { trackId: "t2" })])).toEqual(["a", "b"])
  })

  it("keeps paint order and leaves other clips alone", () => {
    const still = imageClip({ id: "img", trackId: "t0" })
    expect(shape([still, video("a", 0, 3, 0), video("b", 3, 3, 3)])).toEqual(["img", ["a", "b"]])
  })

  it("finds the clip on screen at a frame in the run", () => {
    const run = [video("a", 10, 3, 0), video("b", 13, 3, 3), video("c", 16, 3, 6)]
    expect(clipAt(run, 0).id).toBe("a")
    expect(clipAt(run, 3).id).toBe("b")
    expect(clipAt(run, 8).id).toBe("c")
  })
})
