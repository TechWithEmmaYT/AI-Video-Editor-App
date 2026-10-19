import type { Op, ProjectData } from "@/lib/project/ops"
import type { Clip, CodeClip, TextClip } from "@/lib/project/schema"

/*
 * Development only: a 15-second layout of text and code clips with sections, for checking the
 * timeline against the design without uploading anything. No media clips, so nothing loads
 * from the network. It's a normal edit: undo (⌘Z) removes it.
 */

type Row = [type: "code" | "text", name: string, fromSeconds: number, toSeconds: number][]

const ROWS: Row[] = [
  [
    ["code", "Folder (front)", 0, 1.85],
    ["code", "Prompt card", 1.9, 3.7],
    ["text", "Your repo is the brief.", 3.75, 5.5],
    ["code", "Claude logo", 6, 7.4],
    ["code", "Timeline card", 7.6, 9.4],
    ["code", "Colour beat", 11.5, 13.4],
    ["code", "motion wordmark", 13.45, 15],
  ],
  [
    ["code", "Finds burst", 0, 1.85],
    ["code", "Watch it move", 1.9, 3.7],
    ["code", "Repo scan (files)", 3.75, 5.7],
    ["code", "Yes", 10.2, 11.4],
    ["text", "Say it. Ship it.", 13.5, 15],
  ],
  [
    ["code", "Folder (back)", 0, 1.85],
    ["text", "Claude writes it", 4, 5.5],
    ["text", "An MCP away", 13.5, 15],
  ],
  [
    ["text", "Say it.", 1.75, 3.7],
    ["code", "CTA", 13.5, 15],
  ],
]

const SECTIONS: [name: string, fromSeconds: number, toSeconds: number, color: string][] = [
  ["Prompt", 1.9, 3.7, "#8b5cf6"],
  ["Repo scan", 3.75, 5.6, "#3b82f6"],
  ["Timeline", 7.6, 9.4, "#22c55e"],
  ["Every frame", 9.5, 11.3, "#f59e0b"],
  ["Your brand", 11.4, 13.3, "#ec4899"],
  ["End card", 13.4, 15, "#f97316"],
]

export function sampleClipOps(
  state: ProjectData,
  { fps, width, height, newId }: { fps: number; width: number; height: number; newId: () => string }
): Op[] {
  const at = (seconds: number) => Math.round(seconds * fps)
  const ops: Op[] = []

  ROWS.forEach((row, index) => {
    const trackId = newId()
    ops.push({ type: "addTrack", track: { id: trackId }, index: state.doc.tracks.length + index })
    for (const [type, name, from, to] of row) {
      const base = {
        id: newId(),
        trackId,
        name,
        color: type,
        from: at(from),
        durationInFrames: at(to) - at(from),
        transform: { x: width * 0.1, y: height * 0.35, width: width * 0.8, height: height * 0.3, scale: 1, rotation: 0, opacity: 1 },
      }
      const clip: Clip =
        type === "text"
          ? ({
              ...base,
              type: "text",
              text: name,
              fontFamily: "Inter",
              fontWeight: 800,
              fontSize: Math.round(height / 10),
              color: "#ffffff",
              align: "center",
              letterSpacing: 0,
              lineHeight: 1.1,
            } satisfies TextClip)
          : ({
              ...base,
              type: "code",
              code: "// sample clip",
              params: {},
              paramSchema: [],
              fonts: [],
              radius: 0,
            } satisfies CodeClip)
      ops.push({ type: "addClip", clip })
    }
  })

  for (const [name, from, to, color] of SECTIONS) {
    ops.push({ type: "addSection", section: { id: newId(), name, from: at(from), to: at(to), color } })
  }

  if (state.durationInFrames < at(15)) ops.push({ type: "updateProject", patch: { durationInFrames: at(15) } })
  return ops
}
