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
        imageClip({ id: "i1", trackId: "a", from: 30, durationInFrames: 270, transform: { x: 0, y: 0, width: 1080, height: 1920, scale: 1, rotation: 0, opacity: 1 } }),
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

  it("finds a video shrunk inside the canvas with black around it", () => {
    const { doc } = project({
      tracks: [{ id: "a" }],
      clips: [imageClip({ id: "small", trackId: "a", durationInFrames: 300, transform: { x: 0, y: 0, width: 1080, height: 1920, scale: 0.65, rotation: 0, opacity: 1 } })],
    })
    const problems = docChecks(doc, canvas)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Black edges 0:00.0–0:10.0: nothing fills the whole canvas; small image "Still"')
  })

  it("finds a speaker clip that replays what the clip before it already played", () => {
    const { doc } = project({ tracks: [{ id: "a" }], clips: [] })
    const speaker = (id: string, from: number, durationInFrames: number, trimStartFrames: number) => ({
      ...imageClip({ id, trackId: "a", from, durationInFrames, transform: { x: 0, y: 0, width: 1080, height: 1920, scale: 1, rotation: 0, opacity: 1 } }),
      type: "video" as const,
      name: "Speaker",
      trimStartFrames,
      sourceDurationInFrames: 1380,
      volume: 1,
    })
    doc.clips = [speaker("s1", 0, 99, 0), speaker("s2", 99, 63, 99), speaker("s3", 162, 636, 0), speaker("s4", 798, 117, 798)] as typeof doc.clips
    const problems = docChecks(doc, { ...canvas, durationInFrames: 915 })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('s3 video "Speaker" at 0:05.4 replays its source from 0:00.0')
    expect(problems[0]).toContain("set its trimStart to 5.40 s")
  })

  it("finds a caption hidden behind full-screen b-roll, and b-roll that isn't silent", () => {
    const full = { x: 0, y: 0, width: 1080, height: 1920, scale: 1, rotation: 0, opacity: 1 }
    const video = (id: string, trackId: string, from: number, durationInFrames: number, volume: number) => ({
      ...imageClip({ id, trackId, from, durationInFrames, transform: full }),
      type: "video" as const,
      name: id,
      trimStartFrames: 0,
      sourceDurationInFrames: 900,
      volume,
    })
    const caption = {
      ...imageClip({ id: "cap", trackId: "captions", from: 60, durationInFrames: 30, transform: { x: 64, y: 1020, width: 952, height: 400, scale: 1, rotation: 0, opacity: 1 } }),
      type: "code" as const,
      name: "Modern · Crisp",
      elementId: "crisp-caption",
    }
    const { doc } = project({ tracks: [{ id: "broll" }, { id: "captions" }, { id: "speaker" }], clips: [] })
    doc.clips = [video("speaker", "speaker", 0, 300, 1), video("broll", "broll", 50, 60, 0.4), caption] as typeof doc.clips
    const problems = docChecks(doc, canvas)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('cap code "Modern · Crisp" at 0:02.0 is hidden behind broll video "broll"')
    expect(problems[1]).toContain('broll video "broll" at 0:01.6 plays its own sound over speaker video "speaker"')
  })
})
