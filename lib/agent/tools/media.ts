import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { agentUserId, text, toolError } from "@/lib/agent/context"
import { getUserMedia } from "@/lib/media-transcript"
import { formatTimestamp, transcriptToText } from "@/lib/transcript"

/** Long transcripts are cut here; Claude can ask for a time range instead. */
const MAX_CHARS = 60_000

export function registerMediaTools(server: McpServer) {
  server.registerTool(
    "get_media_transcript",
    {
      title: "Get a media file's transcript",
      description: [
        "What is said in an uploaded video or audio file, as timed lines: [m:ss.s–m:ss.s] text, with chapters first when there are any.",
        "Times are seconds into the source file. A clip plays its source from trimStartFrames / fps, so timeline time T on a clip that starts at `from` is source time (T - from + trimStartFrames) / fps.",
        "Pass from/to (seconds) to read part of a long file.",
        "If the file has no transcript yet, ask the user to add one from the media card's menu in the Media tab (Generate with ImageKit, Upload .srt/.vtt, or Paste).",
      ].join(" "),
      inputSchema: z.object({
        mediaId: z.string().min(1).max(64).describe("The media file's id (a clip's mediaId)."),
        from: z.number().min(0).optional().describe("Start of the range, in seconds of the source file."),
        to: z.number().min(0).optional().describe("End of the range, in seconds of the source file."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ mediaId, from, to }, ctx) => {
      const row = await getUserMedia(agentUserId(ctx), mediaId)
      if (!row) return toolError(`No media file with id "${mediaId}" in your projects. Check the clip's mediaId.`)

      const length = row.durationSec ? `, ${formatTimestamp(row.durationSec)} long` : ""
      if (!row.transcript) {
        return text(
          `"${row.name}" (${row.kind}${length}) has no transcript yet. Ask the user to add one from its card in the Media tab: Generate with ImageKit, Upload .srt/.vtt, or Paste.`
        )
      }

      const body = transcriptToText(row.transcript, { from, to })
      const source = row.transcript.source === "imagekit" ? "ImageKit AI transcription" : "added by the user"
      const range = from !== undefined || to !== undefined ? ` (${formatTimestamp(from ?? 0)} to ${to !== undefined ? formatTimestamp(to) : "end"})` : ""
      const header = `"${row.name}" (${row.kind}${length}): transcript ${source}${range}`
      if (!body) return text(`${header}\n\nNothing is said in that range.`)
      if (body.length <= MAX_CHARS) return text(`${header}\n\n${body}`)

      // Cut at a line break so no line is half-shown.
      const cut = body.slice(0, body.lastIndexOf("\n", MAX_CHARS))
      return text(`${header}\n\n${cut}\n\n[Transcript continues. Call again with \`from\` set to the last time shown to read the rest.]`)
    }
  )
}
