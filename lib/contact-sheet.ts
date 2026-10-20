/*
 * A video's contact sheet: ~12 frames, evenly spread from start to end, in one JPEG grid with each
 * frame's source time stamped on it. Made in the browser from the local file while it uploads
 * (no ImageKit video processing), so Claude can see what's in a video over MCP.
 */

export const CONTACT_SHEET_FRAMES = 12

const GAP = 4
const SEEK_TIMEOUT_MS = 4000
const TOTAL_TIMEOUT_MS = 30_000

/** "1:05.4" */
export function formatSheetTime(seconds: number) {
  const tenths = Math.round(seconds * 10)
  const m = Math.floor(tenths / 600)
  const s = (tenths % 600) / 10
  return `${m}:${s.toFixed(1).padStart(4, "0")}`
}

/** Where frame i of n is taken: the middle of its slice, so it never lands on a black first/last frame. */
export function sheetTimes(duration: number, frames = CONTACT_SHEET_FRAMES) {
  return Array.from({ length: frames }, (_, i) => (duration * (i + 0.5)) / frames)
}

/** Columns and cell size for a w×h video: wide cells for landscape, tall ones for vertical. */
export function sheetLayout(videoWidth: number, videoHeight: number, frames = CONTACT_SHEET_FRAMES) {
  const aspect = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 16 / 9
  const columns = aspect < 0.8 ? 6 : 4
  const cellWidth = aspect < 0.8 ? 180 : aspect > 1.2 ? 320 : 240
  const cellHeight = Math.round(cellWidth / aspect)
  const rows = Math.ceil(frames / columns)
  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    width: columns * cellWidth + (columns + 1) * GAP,
    height: rows * cellHeight + (rows + 1) * GAP,
  }
}

/** Resolves once the video has moved to `time` (or gives up after a few seconds). */
function seek(video: HTMLVideoElement, time: number) {
  return new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer)
      video.removeEventListener("seeked", onSeeked)
      resolve(ok)
    }
    const onSeeked = () => done(true)
    const timer = setTimeout(() => done(false), SEEK_TIMEOUT_MS)
    video.addEventListener("seeked", onSeeked)
    video.currentTime = time
  })
}

/**
 * Builds the sheet from a local video URL (an object URL). Never throws: null if the browser
 * can't decode the file (some HEVC .mov files), it has no length, or it takes too long.
 */
export async function makeContactSheet(videoUrl: string): Promise<Blob | null> {
  const video = document.createElement("video")
  video.muted = true
  video.playsInline = true
  video.preload = "auto"
  video.src = videoUrl

  const work = (async () => {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("Can't decode this video"))
    })
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth) return null

    const layout = sheetLayout(video.videoWidth, video.videoHeight)
    const canvas = document.createElement("canvas")
    canvas.width = layout.width
    canvas.height = layout.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = "#0b0b0d"
    ctx.fillRect(0, 0, layout.width, layout.height)

    let drawn = 0
    for (const [i, time] of sheetTimes(duration).entries()) {
      if (!(await seek(video, time))) continue
      const x = GAP + (i % layout.columns) * (layout.cellWidth + GAP)
      const y = GAP + Math.floor(i / layout.columns) * (layout.cellHeight + GAP)
      ctx.drawImage(video, x, y, layout.cellWidth, layout.cellHeight)
      drawn++

      // The frame's time in the source file, so Claude can point at moments ("the logo at 0:07.5").
      const label = formatSheetTime(time)
      ctx.font = "600 13px ui-monospace, Menlo, monospace"
      const labelWidth = ctx.measureText(label).width + 10
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)"
      ctx.fillRect(x + 4, y + layout.cellHeight - 22, labelWidth, 18)
      ctx.fillStyle = "#ffffff"
      ctx.textBaseline = "middle"
      ctx.fillText(label, x + 9, y + layout.cellHeight - 13)
    }
    if (drawn === 0) return null

    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82))
  })()

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TOTAL_TIMEOUT_MS))
  try {
    return await Promise.race([work, timeout])
  } catch {
    return null
  } finally {
    video.removeAttribute("src")
    video.load()
  }
}
