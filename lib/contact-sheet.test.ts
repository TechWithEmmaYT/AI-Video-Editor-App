import { describe, expect, it } from "vitest"

import { formatSheetTime, sheetLayout, sheetTimes } from "@/lib/contact-sheet"

describe("contact sheet", () => {
  it("spreads 12 frames across the video, avoiding the very first and last frame", () => {
    const times = sheetTimes(60)
    expect(times).toHaveLength(12)
    expect(times[0]).toBe(2.5)
    expect(times[11]).toBe(57.5)
  })

  it("lays out landscape 4×3 with wide cells and vertical 6×2 with tall ones", () => {
    expect(sheetLayout(1920, 1080)).toMatchObject({ columns: 4, rows: 3, cellWidth: 320, cellHeight: 180 })
    expect(sheetLayout(1080, 1920)).toMatchObject({ columns: 6, rows: 2, cellWidth: 180, cellHeight: 320 })
    expect(sheetLayout(1080, 1080)).toMatchObject({ columns: 4, rows: 3, cellWidth: 240, cellHeight: 240 })
  })

  it("formats times as m:ss.s", () => {
    expect(formatSheetTime(2.5)).toBe("0:02.5")
    expect(formatSheetTime(65.44)).toBe("1:05.4")
    expect(formatSheetTime(600)).toBe("10:00.0")
  })
})
