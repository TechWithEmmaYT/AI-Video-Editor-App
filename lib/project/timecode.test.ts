import { describe, expect, it } from "vitest"

import { formatRulerLabel, formatTimecode } from "@/lib/project/timecode"

describe("formatTimecode", () => {
  it.each([
    [0, "0:00.0"],
    [135, "0:04.5"],
    [450, "0:15.0"],
    [1829, "1:00.9"],
    [-5, "0:00.0"],
  ])("frame %i at 30 fps reads %s", (frame, expected) => {
    expect(formatTimecode(frame, 30)).toBe(expected)
  })
})

describe("formatRulerLabel", () => {
  it("pads seconds", () => {
    expect(formatRulerLabel(4)).toBe("0:04")
    expect(formatRulerLabel(75)).toBe("1:15")
  })
})
