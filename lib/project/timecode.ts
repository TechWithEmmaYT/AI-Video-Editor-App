/** "0:04.5": minutes, seconds and tenths, as the editor's timecodes read. */
export function formatTimecode(frame: number, fps: number) {
  const tenths = Math.floor((Math.max(0, frame) / fps) * 10)
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`
}

/** "0:04": ruler labels. */
export function formatRulerLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}
