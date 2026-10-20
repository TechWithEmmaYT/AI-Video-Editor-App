"use client"

import "@imagekit/video-player/styles.css"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { getStreamStatusQueryFn, queryKeys } from "@/lib/api"
import { exportFileUrl, exportPlainUrl } from "@/lib/export/urls"

/** How often to ask again while ImageKit prepares the streams, and when to stop waiting. */
const POLL_MS = 4000
const GIVE_UP_MS = 10 * 60_000
/** The HLS renditions, same as exportHlsUrl (sr-360_720), so ImageKit prepares them only once. */
const STREAM_RESOLUTIONS = [360, 720]

/**
 * Plays a shared export with ImageKit's video player (HLS, 360p + 720p). While ImageKit prepares
 * the streams (it answers 202) it shows "Processing…" and checks every few seconds; if streaming
 * isn't available, it plays the original MP4 instead.
 */
export function SharePlayer({
  exportId,
  mp4Url,
  width,
  height,
}: {
  exportId: string
  mp4Url: string
  width: number
  height: number
}) {
  const [playerFailed, setPlayerFailed] = useState(false)
  // After GIVE_UP_MS of "processing", stop waiting and play the MP4.
  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [])

  const { data, isError } = useQuery({
    queryKey: queryKeys.streamStatus(exportId),
    queryFn: () => getStreamStatusQueryFn(exportId),
    refetchInterval: (query) => (query.state.data?.status === "processing" && !gaveUp ? POLL_MS : false),
    refetchOnWindowFocus: false,
  })

  const timedOut = data?.status === "processing" && gaveUp
  const mode = playerFailed || isError || data?.status === "unavailable" || timedOut ? "mp4" : data?.status === "ready" ? "stream" : "waiting"

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-black shadow-lg"
      // The video's own shape, as large as fits: full width for landscape, ~72% of the screen tall for vertical.
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, 48rem, calc(72svh * ${width / height}))` }}
    >
      {mode === "stream" && <ImageKitPlayer src={exportFileUrl(mp4Url)} onFail={() => setPlayerFailed(true)} />}
      {mode === "mp4" && <video src={exportPlainUrl(mp4Url)} controls playsInline className="size-full object-contain" />}
      {mode === "waiting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <Spinner className="size-6" />
          <p className="text-sm font-semibold">{data?.status === "processing" ? "Processing…" : "Loading…"}</p>
          {data?.status === "processing" && (
            <p className="max-w-xs text-xs text-white/60">Getting the video ready to stream. The first time takes a minute or two.</p>
          )}
        </div>
      )}
    </div>
  )
}

/** "https://ik.imagekit.io/<id>/…" → "<id>" (the player wants the ImageKit ID). */
function imagekitIdOf(url: string) {
  return new URL(url).pathname.split("/")[1] ?? ""
}

/**
 * ImageKit's video player (Video.js underneath) on the export's HLS stream, through its core
 * videoPlayer() call. Not the IKVideoPlayer React wrapper: that beta (built for React 18) sets the
 * player up again on its own <video> after Video.js has removed it, which crashes under React 19's
 * Strict Mode and whenever its options change. Here each mount creates a fresh <video>, and the
 * player is disposed on unmount. It loads on demand because it needs the browser.
 */
function ImageKitPlayer({ src, onFail }: { src: string; onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onFailRef = useRef(onFail)
  useEffect(() => {
    onFailRef.current = onFail
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false
    let dispose = () => {}

    void import("@imagekit/video-player")
      .then(({ videoPlayer }) => {
        if (disposed) return
        const element = document.createElement("video")
        element.className = "video-js vjs-default-skin"
        element.setAttribute("playsinline", "")
        container.appendChild(element)

        const player = videoPlayer(
          element,
          {
            imagekitId: imagekitIdOf(src),
            abs: { protocol: "hls", sr: STREAM_RESOLUTIONS },
            // Seek previews are extra thumbnails, which cost video processing units.
            seekThumbnails: false,
          },
          { controls: true, fill: true, preload: "metadata" }
        )
        player.src({ src })
        player.on("error", () => onFailRef.current())
        dispose = () => player.dispose()
      })
      .catch(() => onFailRef.current())

    return () => {
      disposed = true
      dispose()
    }
  }, [src])

  return <div ref={containerRef} className="size-full" />
}
