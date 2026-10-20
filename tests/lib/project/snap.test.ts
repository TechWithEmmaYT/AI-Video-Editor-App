import { describe, expect, it } from "vitest"

import { snapFrame, snapPoints, snapRange } from "@/lib/project/snap"
import { imageClip, project } from "@/tests/fixtures"

describe("snapping", () => {
  const state = project(
    {
      tracks: [{ id: "t1" }],
      clips: [imageClip({ id: "c1", trackId: "t1", from: 40, durationInFrames: 20 })],
      sections: [{ id: "s1", name: "Intro", from: 0, to: 75, color: "x" }],
    },
    300
  )

  it("collects clip, section, playhead and end points", () => {
    expect(snapPoints(state, { playhead: 100 }).sort((a, b) => a - b)).toEqual([0, 40, 60, 75, 100, 300])
    expect(snapPoints(state, { playhead: 100, excludeClipId: "c1" })).not.toContain(40)
  })

  it("snaps to the nearest point within the threshold", () => {
    const points = snapPoints(state, { playhead: 100 })
    expect(snapFrame(43, points, 4, 30)).toBe(40)
    expect(snapFrame(48, points, 4, 30)).toBe(48)
    expect(snapFrame(88, points, 3, 30)).toBe(90) // whole second
  })

  it("snaps a range by its closer edge", () => {
    const points = [0, 100]
    expect(snapRange(3, 50, points, 5, 1000)).toBe(0) // start → 0
    expect(snapRange(48, 50, points, 5, 1000)).toBe(50) // end → 100
    expect(snapRange(20, 50, points, 5, 1000)).toBe(20) // nothing near
  })
})
