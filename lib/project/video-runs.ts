import type { Clip, VideoClip } from "@/lib/project/schema"

/*
 * Playback performance: every <Video> is its own decoder, and each starts loading a second early.
 * Edits often cut one video into many short pieces that still play it continuously (a punch-in
 * zoom done as 80 slightly bigger 0.1 s clips, or b-roll gaps). Played clip by clip, that's ~10
 * decoders at once. A "run" of such clips plays as ONE <Video>, with each clip's box, radius and
 * volume applied frame by frame, so it looks and sounds exactly the same.
 */

export type RenderItem = { type: "clip"; clip: Clip } | { type: "video-run"; clips: VideoClip[] }

/** b continues a: same track and file, starts the frame a ends, and picks up the source where a stopped. */
function continues(a: VideoClip, b: VideoClip) {
  return (
    a.trackId === b.trackId &&
    a.mediaId === b.mediaId &&
    a.src === b.src &&
    a.fit === b.fit &&
    a.from + a.durationInFrames === b.from &&
    a.trimStartFrames + a.durationInFrames === b.trimStartFrames
  )
}

/**
 * Groups clips for rendering, keeping their order: runs of 2+ continuous video clips become one
 * item; everything else stays a single clip. Clips should already be in paint order.
 */
export function groupVideoRuns(clips: Clip[]): RenderItem[] {
  // Per track, in time order, find which clip each video continues.
  const runOf = new Map<string, VideoClip[]>()
  const byTrack = new Map<string, VideoClip[]>()
  for (const clip of clips) if (clip.type === "video") byTrack.set(clip.trackId, [...(byTrack.get(clip.trackId) ?? []), clip])
  for (const videos of byTrack.values()) {
    videos.sort((a, b) => a.from - b.from)
    let run: VideoClip[] = []
    for (const clip of videos) {
      if (run.length > 0 && continues(run[run.length - 1], clip)) run.push(clip)
      else run = [clip]
      runOf.set(clip.id, run)
    }
  }

  const items: RenderItem[] = []
  const emitted = new Set<VideoClip[]>()
  for (const clip of clips) {
    const run = clip.type === "video" ? runOf.get(clip.id) : undefined
    if (!run || run.length < 2) items.push({ type: "clip", clip })
    else if (!emitted.has(run)) {
      emitted.add(run)
      items.push({ type: "video-run", clips: run })
    }
  }
  return items
}

/** The clip in a run that's on screen `frame` frames after the run starts. */
export function clipAt(run: VideoClip[], frame: number) {
  const absolute = run[0].from + frame
  return run.find((clip) => absolute < clip.from + clip.durationInFrames) ?? run[run.length - 1]
}
