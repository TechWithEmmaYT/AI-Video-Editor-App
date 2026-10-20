/*
 * ImageKit media URLs, kept deliberately cheap. The Free plan has 500 video processing units a
 * month (https://imagekit.io/docs/how-pricing-works#video-processing-units-pricing): a plain video
 * URL gets auto-optimized (WebM/VP9), which uses units, and every new thumbnail costs 30.
 */

function withTransformation(url: string, transformation: string) {
  return `${url}${url.includes("?") ? "&" : "?"}tr=${transformation}`
}

/**
 * The file exactly as uploaded. `orig-true` skips ImageKit's video processing, so playing it
 * (in the editor and in the export) uses no video processing units.
 */
export function originalMediaUrl(src: string) {
  return withTransformation(src, "orig-true")
}

/**
 * A video's poster frame, straight from the URL. Always this exact URL (the media card and the
 * timeline clip share it), so ImageKit makes it once and serves it from cache after that.
 */
export function videoThumbnailUrl(src: string) {
  return `${src}/ik-thumbnail.jpg`
}
