import type { ProjectData } from "@/lib/project/ops"

/** Frames worth snapping to: 0, the end, the playhead, clip edges and section edges. */
export function snapPoints(state: ProjectData, options: { playhead: number; excludeClipId?: string }) {
  const points = new Set<number>([0, state.durationInFrames, options.playhead])
  for (const clip of state.doc.clips) {
    if (clip.id === options.excludeClipId) continue
    points.add(clip.from)
    points.add(clip.from + clip.durationInFrames)
  }
  for (const section of state.doc.sections) {
    points.add(section.from)
    points.add(section.to)
  }
  return [...points]
}

/** The nearest snap point (or whole second) within `threshold` frames, else `frame` unchanged. */
export function snapFrame(frame: number, points: number[], threshold: number, fps: number) {
  let best = frame
  let bestDistance = threshold + 1
  for (const point of [...points, Math.round(frame / fps) * fps]) {
    const distance = Math.abs(point - frame)
    if (distance < bestDistance) {
      best = point
      bestDistance = distance
    }
  }
  return bestDistance <= threshold ? best : frame
}

/** Snaps a moving range by whichever of its edges lands closer to a snap point. Returns the new start. */
export function snapRange(from: number, duration: number, points: number[], threshold: number, fps: number) {
  const start = snapFrame(from, points, threshold, fps)
  const end = snapFrame(from + duration, points, threshold, fps)
  const startShift = start - from
  const endShift = end - (from + duration)
  if (startShift === 0 && endShift === 0) return from
  if (endShift === 0 || (startShift !== 0 && Math.abs(startShift) <= Math.abs(endShift))) return start
  return from + endShift
}
