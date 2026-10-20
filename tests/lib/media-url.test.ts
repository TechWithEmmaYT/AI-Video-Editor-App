import { describe, expect, it } from "vitest"

import { originalMediaUrl, videoThumbnailUrl } from "@/lib/media-url"

const src = "https://ik.imagekit.io/demo/motion/u1/p1/clip.mp4"

describe("originalMediaUrl", () => {
  it("asks for the untouched original, leaving the path alone", () => {
    expect(originalMediaUrl(src)).toBe(`${src}?tr=orig-true`)
  })

  it("appends to an existing query string", () => {
    expect(originalMediaUrl(`${src}?v=2`)).toBe(`${src}?v=2&tr=orig-true`)
  })
})

describe("videoThumbnailUrl", () => {
  it("is one fixed poster-frame URL per video", () => {
    expect(videoThumbnailUrl(src)).toBe(`${src}/ik-thumbnail.jpg`)
  })
})
