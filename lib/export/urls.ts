/*
 * URLs for an exported MP4 on ImageKit (see the plan, §9). Client-safe.
 * Kept cheap on video processing units: playback is HLS in just two resolutions, and the
 * fallback plays the original file (orig-true), which uses none.
 */

/** HLS renditions ImageKit makes (https://imagekit.io/docs/adaptive-bitrate-streaming). */
const STREAM_RESOLUTIONS = "sr-360_720"

/** The file's URL without any query (mp4Url carries ?ik-attachment=true for downloading). */
export function exportFileUrl(mp4Url: string) {
  return mp4Url.split("?")[0]
}

/** The HLS master playlist. ImageKit answers 202 while it prepares the streams, then 200. */
export function exportHlsUrl(mp4Url: string) {
  return `${exportFileUrl(mp4Url)}/ik-master.m3u8?tr=${STREAM_RESOLUTIONS}`
}

/** The MP4 as uploaded, for playing when HLS isn't available. */
export function exportPlainUrl(mp4Url: string) {
  return `${exportFileUrl(mp4Url)}?tr=orig-true`
}

/** The public page that plays an export. */
export function sharePath(exportId: string) {
  return `/share/${exportId}`
}
