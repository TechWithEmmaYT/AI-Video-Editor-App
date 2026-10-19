import { Audio, Video } from "@remotion/media"
import { AbsoluteFill, CanvasImage, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion"

import type { AudioClip, Clip, Doc, TextClip } from "@/lib/project/schema"

/*
 * The video itself. The editor's Player and the export render both use this component,
 * so what you see in the editor is what gets exported.
 *
 * Clips are data (from the project doc), so they're mapped rather than authored as JSX nodes;
 * all timing is already in frames. Media follows the Remotion skill: <Video>/<Audio> from
 * @remotion/media, <CanvasImage> for stills, CSS translate/scale/rotate for transforms.
 */

export type MainProps = { doc: Doc }

export function Main({ doc }: MainProps) {
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
          <ClipView clip={clip} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}

function ClipView({ clip }: { clip: Clip }) {
  switch (clip.type) {
    case "video":
      return (
        <Layer clip={clip}>
          <Video
            src={clip.src}
            trimBefore={clip.trimStartFrames}
            volume={clip.volume}
            objectFit={clip.fit}
            style={{ width: "100%", height: "100%" }}
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
      return <AudioView clip={clip} />
    case "text":
      return (
        <Layer clip={clip}>
          <TextView clip={clip} />
        </Layer>
      )
    case "code":
      // Code clips get their canvas runtime in Phase 6 of the plan.
      return (
        <Layer clip={clip} radius={clip.radius}>
          <div style={{ width: "100%", height: "100%", border: "4px dashed rgba(79,196,176,0.7)" }} />
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

function AudioView({ clip }: { clip: AudioClip }) {
  // Inside the clip's <Sequence>, so frame 0 is the clip's first frame.
  const frame = useCurrentFrame()
  const { durationInFrames: length, fadeInFrames: fadeIn, fadeOutFrames: fadeOut } = clip

  const fadeInLevel = fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1
  const fadeOutLevel =
    fadeOut > 0 ? interpolate(frame, [length - fadeOut, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1

  return <Audio src={clip.src} trimBefore={clip.trimStartFrames} volume={clip.volume * fadeInLevel * fadeOutLevel} />
}

function TextView({ clip }: { clip: TextClip }) {
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
        fontFamily: clip.fontFamily,
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
