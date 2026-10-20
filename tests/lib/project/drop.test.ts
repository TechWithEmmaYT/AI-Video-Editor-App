import { describe, expect, it } from "vitest"

import { hasMediaDragData, MEDIA_DRAG_TYPE, readMediaDragData, setMediaDragData } from "@/lib/media-drag"
import { mediaDropOps, planMediaDrop, type DropOptions } from "@/lib/project/drop"
import { applyOps } from "@/lib/project/ops"
import { docSchema, type Clip } from "@/lib/project/schema"
import { idSequence, imageClip, project } from "@/tests/fixtures"
import type { Media } from "@/types/project"

/** Just enough of the browser's DataTransfer for a drag between a card and the timeline. */
class FakeDataTransfer {
  private data = new Map<string, string>()
  effectAllowed = "none"
  dropEffect = "none"
  get types() {
    return [...this.data.keys()]
  }
  setData(type: string, value: string) {
    this.data.set(type, value)
  }
  getData(type: string) {
    return this.data.get(type) ?? ""
  }
}

function media(overrides: Partial<Media> = {}): Media {
  return {
    id: "media-1",
    projectId: "p1",
    kind: "video",
    name: "Clip.mp4",
    mime: "video/mp4",
    size: 1234,
    imagekitFileId: "ik-1",
    filePath: "/motion/u/p/clip.mp4",
    url: "https://ik.imagekit.io/demo/clip.mp4",
    thumbnailUrl: "https://ik.imagekit.io/demo/clip.mp4/ik-thumbnail.jpg",
    width: 1920,
    height: 1080,
    durationSec: 4,
    contactSheetUrl: null,
    transcriptSource: null,
    createdAt: "2026-10-17T00:00:00.000Z",
    ...overrides,
  }
}

/** Simulates card → timeline: the card's onDragStart, then the timeline's onDrop. */
function drag(row: Media) {
  const dataTransfer = new FakeDataTransfer() as unknown as DataTransfer
  setMediaDragData({ dataTransfer }, row)
  return dataTransfer
}

// One id sequence for the whole file, so several drops in a test never reuse an id.
const ids = idSequence()

const options = (overrides: Partial<DropOptions> = {}): DropOptions => ({
  frame: 0,
  target: { kind: "new-track", index: 0 },
  fps: 30,
  width: 1920,
  height: 1080,
  newId: ids,
  ...overrides,
})

/** Runs a drop and returns the resulting project (and checks the doc is still valid). */
function drop(state: ReturnType<typeof project>, row: Media, opts: Partial<DropOptions> = {}) {
  const result = mediaDropOps(state, drag(row), options(opts))
  if (!result) throw new Error("drop was ignored")
  const next = applyOps(state, result.ops)
  expect(docSchema.safeParse(next.doc).success).toBe(true)
  const clip = next.doc.clips.find((c) => c.id === result.clipId) as Clip
  return { next, clip, result }
}

describe("media drag contract", () => {
  it("uses the agreed type and sends only the payload fields", () => {
    const dataTransfer = drag(media())
    expect(dataTransfer.types).toEqual([MEDIA_DRAG_TYPE])
    expect(MEDIA_DRAG_TYPE).toBe("application/x-motion-media")
    expect(Object.keys(JSON.parse(dataTransfer.getData(MEDIA_DRAG_TYPE))).sort()).toEqual(
      ["durationSec", "height", "id", "kind", "name", "thumbnailUrl", "url", "width"].sort()
    )
    expect(dataTransfer.effectAllowed).toBe("copy")
    expect(hasMediaDragData(dataTransfer)).toBe(true)
  })

  it("round-trips the payload", () => {
    expect(readMediaDragData(drag(media({ kind: "audio", width: null, height: null })))).toEqual({
      id: "media-1",
      kind: "audio",
      name: "Clip.mp4",
      url: "https://ik.imagekit.io/demo/clip.mp4",
      thumbnailUrl: "https://ik.imagekit.io/demo/clip.mp4/ik-thumbnail.jpg",
      width: null,
      height: null,
      durationSec: 4,
    })
  })

  it("ignores drops that aren't media cards", () => {
    const files = new FakeDataTransfer() as unknown as DataTransfer
    files.setData("text/plain", "hello")
    expect(hasMediaDragData(files)).toBe(false)
    expect(mediaDropOps(project(), files, options())).toBeNull()

    const broken = new FakeDataTransfer() as unknown as DataTransfer
    broken.setData(MEDIA_DRAG_TYPE, "{not json")
    expect(readMediaDragData(broken)).toBeNull()

    const wrongShape = new FakeDataTransfer() as unknown as DataTransfer
    wrongShape.setData(MEDIA_DRAG_TYPE, JSON.stringify({ id: "x", kind: "pdf" }))
    expect(readMediaDragData(wrongShape)).toBeNull()
  })
})

describe("dropping media on the timeline", () => {
  it("creates a track and a video clip at the drop frame, as long as the video", () => {
    const { next, clip } = drop(project(), media({ durationSec: 4 }), { frame: 45 })
    expect(next.doc.tracks).toHaveLength(1)
    expect(clip).toMatchObject({
      type: "video",
      trackId: next.doc.tracks[0].id,
      from: 45,
      durationInFrames: 120,
      sourceDurationInFrames: 120,
      trimStartFrames: 0,
      mediaId: "media-1",
      src: "https://ik.imagekit.io/demo/clip.mp4",
      name: "Clip.mp4",
    })
  })

  it("gives images 5 seconds", () => {
    const { clip } = drop(project(), media({ kind: "image", durationSec: null }))
    expect(clip).toMatchObject({ type: "image", durationInFrames: 150 })
  })

  it("falls back to 5 seconds for video with an unknown length", () => {
    const { clip } = drop(project(), media({ durationSec: null }))
    expect(clip).toMatchObject({ durationInFrames: 150, sourceDurationInFrames: null })
  })

  it("fits visual media inside the canvas, centred", () => {
    const { clip } = drop(project(), media({ width: 1080, height: 1920 }))
    expect(clip.transform).toMatchObject({ width: 608, height: 1080, x: 656, y: 0 })
  })

  it("clamps a drop before 0:00 to the start", () => {
    const { clip } = drop(project(), media(), { frame: -20 })
    expect(clip.from).toBe(0)
  })

  it("puts a visual clip on the target track when that spot is free", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c1", trackId: "t1", durationInFrames: 30 })] })
    const { next, clip } = drop(state, media(), { frame: 60, target: { kind: "track", trackId: "t1" } })
    expect(clip.trackId).toBe("t1")
    expect(next.doc.tracks).toHaveLength(1)
  })

  it("creates a new track above the target when the spot is taken", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c1", trackId: "t1", durationInFrames: 90 })] })
    const { next, clip } = drop(state, media(), { frame: 30, target: { kind: "track", trackId: "t1" } })
    expect(next.doc.tracks.map((t) => t.id)).toEqual([clip.trackId, "t1"])
  })

  it("sends audio to a new bottom track, wherever it's dropped", () => {
    const state = project({ tracks: [{ id: "t1" }, { id: "t2" }], clips: [imageClip({ id: "c1", trackId: "t1" }), imageClip({ id: "c2", trackId: "t2" })] })
    const { next, clip } = drop(state, media({ kind: "audio" }), { target: { kind: "track", trackId: "t1" } })
    expect(clip.type).toBe("audio")
    expect(next.doc.tracks.at(-1)?.id).toBe(clip.trackId)
    expect(next.doc.tracks).toHaveLength(3)
  })

  it("reuses the bottom audio track when there's room, adds another when there isn't", () => {
    const first = drop(project(), media({ kind: "audio", durationSec: 2 }), { frame: 0 })
    const second = drop(first.next, media({ id: "m2", kind: "audio", durationSec: 2 }), { frame: 90 })
    expect(second.clip.trackId).toBe(first.clip.trackId)

    const overlapping = drop(second.next, media({ id: "m3", kind: "audio", durationSec: 2 }), { frame: 30 })
    expect(overlapping.clip.trackId).not.toBe(first.clip.trackId)
    expect(overlapping.next.doc.tracks.at(-1)?.id).toBe(overlapping.clip.trackId)
  })

  it("keeps new visual tracks above the audio tracks", () => {
    const withAudio = drop(project(), media({ kind: "audio" }))
    const audioTrack = withAudio.clip.trackId
    const { next, clip } = drop(withAudio.next, media({ id: "v2" }), {
      target: { kind: "new-track", index: withAudio.next.doc.tracks.length }, // below everything
    })
    expect(next.doc.tracks.map((t) => t.id)).toEqual([clip.trackId, audioTrack])
  })

  it("grows the project when the clip ends past its length", () => {
    const { next } = drop(project({}, 90), media({ durationSec: 10 }), { frame: 30 })
    expect(next.durationInFrames).toBe(330)
  })

  it("doesn't shrink or touch the length when the clip fits", () => {
    const result = planMediaDrop(project({}, 900), readMediaDragData(drag(media()))!, options())
    expect(result.ops.some((op) => op.type === "updateProject")).toBe(false)
  })
})

