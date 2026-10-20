import { Audio, Video } from "@remotion/media"
import { useEffect, useRef, useState } from "react"
import {
  AbsoluteFill,
  CanvasImage,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"

import { fontStack, loadFont } from "@/lib/fonts"
import { CodeClipView } from "@/remotion/code-clip"
import { originalMediaUrl } from "@/lib/media-url"
import type { AudioClip, Clip, Doc, TextClip } from "@/lib/project/schema"

/*
 * The video itself. The editor's Player and the export render both use this component,
 * so what you see in the editor is what gets exported.
 *
 * Clips are data (from the project doc), so they're mapped rather than authored as JSX nodes;
 * all timing is already in frames. Media follows the Remotion skill: <Video>/<Audio> from
 * @remotion/media, <CanvasImage> for stills, CSS translate/scale/rotate for transforms.
 */

export type MainProps = {
  doc: Doc
  /** The editor sets this: a file that won't play only warns. Export leaves it off, so a broken file fails the render. */
  preview?: boolean
}

export function Main({ doc, preview = false }: MainProps) {
  const { fps } = useVideoConfig()
  const trackIndex = new Map(doc.tracks.map((track, index) => [track.id, index]))
  // Track 0 is the top row: paint the bottom track first and track 0 last, so it lands on top.
  const clips = doc.clips
    .filter((clip) => trackIndex.has(clip.trackId))
    .sort((a, b) => trackIndex.get(b.trackId)! - trackIndex.get(a.trackId)!)

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Premounted a second early so media has loaded by the time the playhead gets there;
          otherwise the Player pauses to buffer. Premounting needs the default layout. */}
      {clips.map((clip) => (
        <Sequence key={clip.id} name={clip.name} from={clip.from} durationInFrames={clip.durationInFrames} premountFor={fps}>
          <ClipView clip={clip} preview={preview} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

function ClipView({ clip, preview }: { clip: Clip; preview: boolean }) {
  switch (clip.type) {
    case "video":
      return (
        <Layer clip={clip}>
          <Video
            // The original file, untouched: no ImageKit video processing, in the editor or the export.
            src={originalMediaUrl(clip.src)}
            trimBefore={clip.trimStartFrames}
            volume={clip.volume}
            objectFit={clip.fit}
            style={{ width: "100%", height: "100%" }}
            fallbackOffthreadVideoProps={preview ? { onError: warnMediaError(clip.name) } : undefined}
          />
        </Layer>
      )
    case "image":
      return (
        <Layer clip={clip} radius={clip.radius}>
          <CanvasImage
            src={clip.src}
            width={clip.transform.width}
            height={clip.transform.height}
            fit={clip.fit}
            style={{ width: "100%", height: "100%" }}
          />
        </Layer>
      )
    case "audio":
      return <AudioView clip={clip} preview={preview} />
    case "text":
      return (
        <Layer clip={clip}>
          <TextView clip={clip} />
        </Layer>
      )
    case "code":
      return (
        <Layer clip={clip} radius={clip.radius}>
          <CodeClipView clip={clip} />
        </Layer>
      )
  }
}

/** Positions a clip's box from its transform. The content inside only fills the box. */
function Layer({ clip, radius, children }: { clip: Clip; radius?: number; children: React.ReactNode }) {
  const { x, y, width, height, scale, rotation, opacity } = clip.transform
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        opacity,
        scale,
        rotate: `${rotation}deg`,
        borderRadius: radius || undefined,
        overflow: radius ? "hidden" : undefined,
      }}
    >
      {children}
    </div>
  )
}

function AudioView({ clip, preview }: { clip: AudioClip; preview: boolean }) {
  // Inside the clip's <Sequence>, so frame 0 is the clip's first frame.
  const frame = useCurrentFrame()
  const { durationInFrames: length, fadeInFrames: fadeIn, fadeOutFrames: fadeOut } = clip

  const fadeInLevel = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1
  const fadeOutLevel =
    fadeOut > 0 ? interpolate(frame, [length - fadeOut, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1

  return (
    <Audio
      src={originalMediaUrl(clip.src)}
      trimBefore={clip.trimStartFrames}
      volume={clip.volume * fadeInLevel * fadeOutLevel}
      fallbackHtml5AudioProps={preview ? { onError: warnMediaError(clip.name) } : undefined}
    />
  )
}

function TextView({ clip }: { clip: TextClip }) {
  useFont(clip.fontFamily, clip.fontWeight)
  const justify = { left: "flex-start", center: "center", right: "flex-end" }[clip.align]
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        textAlign: clip.align,
        whiteSpace: "pre-wrap",
        fontFamily: fontStack(clip.fontFamily),
        fontWeight: clip.fontWeight,
        fontSize: clip.fontSize,
        color: clip.color,
        letterSpacing: clip.letterSpacing,
        lineHeight: clip.lineHeight,
      }}
    >
      {clip.text}
    </div>
  )
}

/**
 * Loads a text clip's font. When rendering the export, the frame waits for it (delayRender) so
 * no frame is captured in a fallback font; in the editor the text simply swaps in when it arrives.
 */
function useFont(family: string, weight: number) {
  const [handle] = useState(() => (getRemotionEnvironment().isRendering ? delayRender(`Loading font ${family}`) : null))
  const released = useRef(false)

  useEffect(() => {
    // Release the hold once, whichever load finishes (loadFont never rejects).
    loadFont(family, weight).then(() => {
      if (handle === null || released.current) return
      released.current = true
      continueRender(handle)
    })
  }, [family, weight, handle])
}

/**
 * In the editor, a file that won't play (deleted from ImageKit, offline) shouldn't take the whole
 * preview down: warn and carry on. Export doesn't pass this, so a broken file still fails the render.
 */
function warnMediaError(clipName: string) {
  return (error: Error) => console.warn(`Couldn't play "${clipName}" in the preview.`, error.message)
}
