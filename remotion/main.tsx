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
import type { AudioClip, Clip, Doc, TextClip, VideoClip } from "@/lib/project/schema"
import { clipAt, groupVideoRuns } from "@/lib/project/video-runs"

/*
 * The video itself. The editor's Player and the export render both use this component,
 * so what you see in the editor is what gets exported.
 *
 * Clips are data (from the project doc), so they're mapped rather than authored as JSX nodes;
 * all timing is already in frames. Media follows the Remotion skill: <Video>/<Audio> from
 * @remotion/media, <CanvasImage> for stills, CSS translate/scale/rotate for transforms.
 */

/**
 * Audio clips start preparing this many seconds early. Each one decodes its file in JavaScript
 * (@remotion/media); with a busy timeline, 1 s wasn't enough for short sound effects and the
 * Player kept pausing to wait for them. Premounting doesn't change what's heard or exported.
 */
const AUDIO_PREMOUNT_SECONDS = 3

export type MainProps = {
  doc: Doc
  /** The editor sets this: a file that won't play only warns. Export leaves it off, so a broken file fails the render. */
  preview?: boolean
  /**
   * The editor's Player only: ImageKit URL → a copy in this browser (stores/local-media-store.ts),
   * so cuts seek a local file. Export leaves it off and plays the ImageKit originals.
   */
  localSources?: LocalSources
}

type LocalSources = Record<string, string>

/** Where a video or audio clip's file plays from. */
function playbackUrl(src: string, localSources: LocalSources | undefined) {
  return localSources?.[src] ?? originalMediaUrl(src)
}

export function Main({ doc, preview = false, localSources }: MainProps) {
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
      {/* Runs of short clips that play one video continuously share a single <Video> (see video-runs.ts). */}
      {groupVideoRuns(clips).map((item) => {
        if (item.type === "clip") {
          const { clip } = item
          return (
            <Sequence key={clip.id} name={clip.name} from={clip.from} durationInFrames={clip.durationInFrames} premountFor={clip.type === "audio" ? fps * AUDIO_PREMOUNT_SECONDS : fps}>
              <ClipView clip={clip} preview={preview} localSources={localSources} />
            </Sequence>
          )
        }
        const first = item.clips[0]
        const last = item.clips[item.clips.length - 1]
        return (
          <Sequence
            key={`run:${first.id}`}
            name={`${first.name} (${item.clips.length} clips)`}
            from={first.from}
            durationInFrames={last.from + last.durationInFrames - first.from}
            premountFor={fps}
          >
            <VideoRunView clips={item.clips} preview={preview} localSources={localSources} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

type MediaViewProps = { preview: boolean; localSources: LocalSources | undefined }

function ClipView({ clip, preview, localSources }: { clip: Clip } & MediaViewProps) {
  switch (clip.type) {
    case "video":
      return (
        <Layer clip={clip} radius={clip.radius}>
          <Video
            // The original file, untouched (no ImageKit video processing), or the editor's local copy of it.
            src={playbackUrl(clip.src, localSources)}
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
      return <AudioView clip={clip} preview={preview} localSources={localSources} />
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

/**
 * Several continuous clips of one video as a single <Video> (one decoder): the file plays straight
 * through while each frame takes its box, radius and volume from the clip on screen then.
 */
function VideoRunView({ clips, preview, localSources }: { clips: VideoClip[] } & MediaViewProps) {
  const frame = useCurrentFrame()
  const active = clipAt(clips, frame)
  return (
    <Layer clip={active} radius={active.radius} animate={false}>
      <Video
        src={playbackUrl(clips[0].src, localSources)}
        trimBefore={clips[0].trimStartFrames}
        volume={(f) => clipAt(clips, f).volume}
        objectFit={active.fit}
        style={{ width: "100%", height: "100%" }}
        fallbackOffthreadVideoProps={preview ? { onError: warnMediaError(clips[0].name) } : undefined}
      />
    </Layer>
  )
}

/**
 * Positions a clip's box from its transform, and folds in its entrance and exit. The content
 * inside only fills the box. `animate` is off for video runs, where the frame is relative to the
 * run rather than to the clip, so an entrance would fire at the wrong moment.
 */
function Layer({ clip, radius, animate = true, children }: { clip: Clip; radius?: number; animate?: boolean; children: React.ReactNode }) {
  const { x, y, width, height, scale, rotation, opacity } = clip.transform
  const motion = useClipMotion(clip, animate)
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        opacity: opacity * motion.opacity,
        scale: scale * motion.scale,
        rotate: `${rotation}deg`,
        translate: motion.translateY ? `0 ${motion.translateY * height}px` : undefined,
        filter: motion.blur ? `blur(${motion.blur}px)` : undefined,
        clipPath: motion.reveal < 1 ? `inset(${(1 - motion.reveal) * 100}% 0 0 0)` : undefined,
        borderRadius: radius || undefined,
        overflow: radius ? "hidden" : undefined,
      }}
    >
      {children}
    </div>
  )
}

const NO_MOTION = { opacity: 1, scale: 1, translateY: 0, blur: 0, reveal: 1 }

/** One motion preset at progress `k` (0 = fully out, 1 = fully in). `away` flips the direction. */
function motionAt(preset: Clip["animateIn"], k: number, away: boolean) {
  const eased = 1 - (1 - k) ** 3
  switch (preset) {
    case "pop": {
      // Overshoots slightly on the way in, like the caption words.
      const back = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2
      return { ...NO_MOTION, opacity: Math.min(1, k * 2), scale: 0.72 + 0.28 * back }
    }
    case "rise":
      return { ...NO_MOTION, opacity: k, translateY: (1 - eased) * (away ? -0.12 : 0.12) }
    case "scale":
      return { ...NO_MOTION, opacity: k, scale: 0.6 + 0.4 * eased }
    case "grow":
      return { ...NO_MOTION, opacity: Math.min(1, k * 4), scale: eased }
    case "wipe":
      return { ...NO_MOTION, reveal: eased }
    case "blur":
      return { ...NO_MOTION, opacity: k, blur: (1 - eased) * 14 }
    default:
      return NO_MOTION
  }
}

/** The clip's entrance and exit at the current frame, combined. */
function useClipMotion(clip: Clip, animate: boolean) {
  const frame = useCurrentFrame()
  if (!animate) return NO_MOTION

  const { animateIn, animateInFrames, animateOut, animateOutFrames, durationInFrames } = clip
  const entering = animateIn !== "none" && animateInFrames > 0 && frame < animateInFrames
  const leaving = animateOut !== "none" && animateOutFrames > 0 && frame > durationInFrames - animateOutFrames

  if (entering) return motionAt(animateIn, clamp01(frame / animateInFrames), false)
  if (leaving) return motionAt(animateOut, clamp01((durationInFrames - frame) / animateOutFrames), true)
  return NO_MOTION
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function AudioView({ clip, preview, localSources }: { clip: AudioClip } & MediaViewProps) {
  // Inside the clip's <Sequence>, so frame 0 is the clip's first frame.
  const frame = useCurrentFrame()
  const { durationInFrames: length, fadeInFrames: fadeIn, fadeOutFrames: fadeOut } = clip

  const fadeInLevel = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1
  const fadeOutLevel =
    fadeOut > 0 ? interpolate(frame, [length - fadeOut, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1

  return (
    <Audio
      src={playbackUrl(clip.src, localSources)}
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
