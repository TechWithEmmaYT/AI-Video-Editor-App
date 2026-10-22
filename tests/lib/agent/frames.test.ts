import { describe, expect, it } from "vitest"

import { docChecks, onScreen, pickFrames } from "@/lib/agent/frames"
import type { TextClip } from "@/lib/project/schema"
import { imageClip, project } from "@/tests/fixtures"

const canvas = { width: 1080, height: 1920, fps: 30, durationInFrames: 300, format: "9:16" }

function textClip(overrides: Partial<TextClip> & Pick<TextClip, "id" | "trackId">): TextClip {
  const { doc } = project({ clips: [imageClip({ id: "base", trackId: "t" })] })
  return {
    ...doc.clips[0],
    type: "text",
    name: "Hook",
    transform: { x: 90, y: 800, width: 900, height: 200, scale: 1, rotation: 0, opacity: 1 },
    text: "Hello",
    fontFamily: "Inter",
    fontWeight: 800,
    fontSize: 80,
    color: "#ffffff",
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.1,
    ...overrides,
  } as TextClip
}

describe("pickFrames", () => {
  it("spreads frames over the range, in the middle of each slice", () => {
    expect(pickFrames({ durationInFrames: 300, fps: 30 }, { count: 3 })).toEqual([50, 150, 249])
    expect(pickFrames({ durationInFrames: 300, fps: 30 }, { from: 2, to: 4, count: 2 })).toEqual([75, 105])
  })

  it("takes exact times, clamped to the video and without repeats", () => {
    expect(pickFrames({ durationInFrames: 300, fps: 30 }, { times: [20, 1, 1.01, 0] })).toEqual([0, 30, 299])
  })
})

describe("onScreen", () => {
  it("lists visible clips top track first, and says when the frame is black", () => {
    const { doc } = project({
      tracks: [{ id: "top" }, { id: "bottom" }],
      clips: [imageClip({ id: "bg", trackId: "bottom", durationInFrames: 60 }), textClip({ id: "t1", trackId: "top", from: 10, durationInFrames: 20 })],
    })
    expect(onScreen(doc, 15)).toBe('t1 text "Hook" · bg image "Still"')
    expect(onScreen(doc, 90)).toBe("nothing (black)")
  })
})

describe("docChecks", () => {
  it("finds black gaps, boxes past the edge and text outside the 9:16 safe zone", () => {
    const { doc } = project({
      tracks: [{ id: "a" }],
      clips: [
        imageClip({ id: "i1", trackId: "a", from: 30, durationInFrames: 30 }),
        textClip({ id: "edge", trackId: "a", from: 60, durationInFrames: 30, transform: { x: 600, y: 800, width: 900, height: 200, scale: 1, rotation: 0, opacity: 1 } }),
        textClip({ id: "high", trackId: "a", from: 90, durationInFrames: 210, transform: { x: 90, y: 40, width: 900, height: 200, scale: 1, rotation: 0, opacity: 1 } }),
      ],
    })
    const problems = docChecks(doc, canvas)
    expect(problems[0]).toContain("Black screen 0:00.0–0:01.0")
    expect(problems.some((line) => line.startsWith('edge text "Hook"') && line.includes("past the canvas edge"))).toBe(true)
    expect(problems.some((line) => line.startsWith('high text "Hook"') && line.includes("safe zone"))).toBe(true)
    expect(problems).toHaveLength(3)
  })
})
