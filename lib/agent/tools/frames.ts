import "server-only"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"
import { runs, tasks } from "@trigger.dev/sdk"
import { z } from "zod"

import { AgentError, agentUserId, handled } from "@/lib/agent/context"
import { DEFAULT_FRAMES, DETAIL_FRAME_SIZE, docChecks, FRAME_SIZE, frameLabel, MAX_DETAIL_FRAMES, MAX_FRAMES, onScreen, pickFrames } from "@/lib/agent/frames"
import { resolveClip, resolveProject } from "@/lib/agent/resolve"
import type { RenderFramesOutput } from "@/lib/export/types"
import type { renderFrames } from "@/trigger/render-frames"

/** How long the tool waits for the frames (the MCP route allows 300 s). */
const WAIT_MS = 240_000
const POLL_MS = 1500
/** Run statuses that mean it ended without frames. */
const ENDED = new Set(["FAILED", "CRASHED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT", "CANCELED"])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits for the run's frames. Null when it ended without them or took too long. */
async function waitForFrames(runId: string): Promise<RenderFramesOutput | null> {
  const deadline = Date.now() + WAIT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const run = await runs.retrieve<typeof renderFrames>(runId)
    if (run.status === "COMPLETED") return (run.output as RenderFramesOutput | undefined) ?? null
    if (ENDED.has(run.status)) {
      console.error(`render-frames run ${runId} ended (${run.status})`, run.error?.message)
      return null
    }
  }
  return null
}

export function registerFrameTools(server: McpServer) {
  server.registerTool(
    "render_frames",
    {
      title: "Look at the video you made",
      description: [
        "Renders stills of the project exactly as the export will look (same renderer: video, captions, elements, motion) and shows them to you, each labelled with its time and what's on screen.",
        "Use it after every round of edits to see your work, then fix what looks wrong and look again.",
        "Pick frames with `times` (seconds), or `from`/`to`/`count` for frames spread over a range (default: 8 over the whole video), or `clipId` for frames across one clip.",
        "`detail: true` renders up to 3 frames large, to read small text or check an edge.",
        "Takes about 10–60 s. Also lists problems found in the doc (black gaps, boxes off the canvas, text outside the safe zone).",
      ].join(" "),
      inputSchema: z.object({
        times: z.array(z.number().min(0)).min(1).max(MAX_FRAMES).optional().describe("Exact moments, in seconds of the timeline."),
        from: z.number().min(0).optional().describe("Start of the range, in seconds. Default 0."),
        to: z.number().min(0).optional().describe("End of the range, in seconds. Default: the end."),
        count: z.number().int().min(1).max(MAX_FRAMES).optional().describe(`How many frames over the range. Default 8, at most ${MAX_FRAMES}.`),
        clipId: z.string().min(1).max(64).optional().describe('Frames across this clip\'s time on the timeline ("this" = the selected clip).'),
        detail: z.boolean().optional().describe(`Large frames (${DETAIL_FRAME_SIZE} px), at most ${MAX_DETAIL_FRAMES}.`),
        projectId: z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor."),
      }),
      annotations: { readOnlyHint: true },
    },
    handled(
      async (
        args: { times?: number[]; from?: number; to?: number; count?: number; clipId?: string; detail?: boolean; projectId?: string },
        ctx
      ) => {
        const userId = agentUserId(ctx)
        const project = await resolveProject(userId, args.projectId)
        const { doc, fps, durationInFrames } = project
        if (!doc.clips.some((clip) => clip.type !== "audio")) throw new AgentError("Nothing to look at yet: the timeline has no video, image, text or element clips.")

        let { from, to } = args
        if (args.clipId) {
          const clip = await resolveClip(userId, doc.clips, args.clipId)
          from = clip.from / fps
          to = (clip.from + clip.durationInFrames - 1) / fps
        }
        const limit = args.detail ? MAX_DETAIL_FRAMES : MAX_FRAMES
        const count = Math.min(args.count ?? (args.detail ? 1 : DEFAULT_FRAMES), limit)
        const frames = pickFrames({ durationInFrames, fps }, { times: args.times, from, to, count }).slice(0, limit)

        const handle = await tasks.trigger<typeof renderFrames>(
          "render-frames",
          {
            userId,
            projectId: project.id,
            width: project.width,
            height: project.height,
            fps,
            durationInFrames,
            doc,
            frames,
            size: args.detail ? DETAIL_FRAME_SIZE : FRAME_SIZE,
          },
          // One look at a time per user; one that hasn't started within 2 minutes is dropped.
          { concurrencyKey: userId, tags: [`project_${project.id}`], ttl: "2m" }
        )
        const output = await waitForFrames(handle.id)
        if (!output) {
          throw new AgentError(
            "The frames couldn't be rendered this time (the renderer failed or took too long). Try again with fewer frames; if it keeps failing, tell the user."
          )
        }

        const content: CallToolResult["content"] = [
          {
            type: "text",
            text: `"${project.name}" · ${project.format} ${project.width}×${project.height} · version ${project.version}. ${output.frames.length} frame${output.frames.length === 1 ? "" : "s"} below, each with its time and what's on screen (top track first).`,
          },
        ]
        for (const { frame, jpeg, error } of output.frames) {
          const label = `${frameLabel(frame, fps)} · on screen: ${onScreen(doc, frame)}`
          if (jpeg) {
            content.push({ type: "text", text: label }, { type: "image", data: jpeg, mimeType: "image/jpeg" })
          } else {
            content.push({ type: "text", text: `${label}\nThis frame failed to render: ${error ?? "unknown error"}` })
          }
        }

        const problems = docChecks(doc, project)
        content.push({
          type: "text",
          text: problems.length
            ? `Checks found ${problems.length} problem${problems.length === 1 ? "" : "s"} in the doc:\n${problems.map((line) => `- ${line}`).join("\n")}`
            : "Checks: no black gaps, nothing past the canvas edge.",
        })
        content.push({
          type: "text",
          text: "Now compare each frame with what you meant to make and with your reference. Fix what's wrong, then call render_frames again on the same times until they look right.",
        })
        return { content }
      }
    )
  )
}
