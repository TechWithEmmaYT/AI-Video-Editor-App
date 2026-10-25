import type { ProjectData } from "@/lib/project/ops"
import { CLIP_MOTION_DEFAULTS, type Clip, type Doc, type ImageClip } from "@/lib/project/schema"

// Shared builders for unit tests.

export function project(doc: Partial<Doc> = {}, durationInFrames = 450): ProjectData {
  return { name: "Test", durationInFrames, format: "16:9", doc: { tracks: [], clips: [], sections: [], ...doc } }
}

export function imageClip(overrides: Partial<ImageClip> & Pick<Clip, "id" | "trackId">): ImageClip {
  return {
  ...CLIP_MOTION_DEFAULTS,
    type: "image",
    name: "Still",
    color: "blue",
    from: 0,
    durationInFrames: 30,
    transform: { x: 0, y: 0, width: 1920, height: 1080, scale: 1, rotation: 0, opacity: 1 },
    mediaId: "m1",
    src: "https://ik.imagekit.io/demo/still.png",
    fit: "cover",
    radius: 0,
    ...overrides,
  }
}

/** Deterministic ids: "id-1", "id-2", ... */
export function idSequence() {
  let n = 0
  return () => `id-${++n}`
}
