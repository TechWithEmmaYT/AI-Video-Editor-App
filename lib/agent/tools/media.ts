import "server-only"

import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { uploadFromUrl } from "@/lib/agent/imagekit-upload"
import { resolveProject } from "@/lib/agent/resolve"
import { createMedia, listMedia } from "@/lib/media"
import { getUserMedia } from "@/lib/media-transcript"
import { projectChannel, publish } from "@/lib/realtime/bus"
import { formatTimestamp, transcriptToText } from "@/lib/transcript"

/** Long transcripts are cut here; Claude can ask for a time range instead. */
const MAX_TRANSCRIPT_CHARS = 60_000
/** Images sent to Claude are capped (contact sheets are ~50–150 KB). */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")

const describeMedia = (m: { id: string; kind: string; name: string; width: number | null; height: number | null; durationSec: number | null }) =>
  `${m.id} · ${m.kind} "${m.name}"${m.width && m.height ? ` · ${m.width}×${m.height}` : ""}${m.durationSec ? ` · ${formatTimestamp(m.durationSec)}` : ""}`

/** Fetches an image from ImageKit and returns it as MCP image content Claude can see. */
async function imageContent(url: string): Promise<CallToolResult["content"][number] | null> {
  const response = await fetch(url).catch(() => null)
  if (!response?.ok || response.status === 202) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg"
  return { type: "image", data: bytes.toString("base64"), mimeType }
}

export function registerMediaTools(server: McpServer) {
  server.registerTool(
    "list_media",
    {
      title: "List a project's media",
      description: "Files uploaded to (or added by you to) a project: ids, kind, size, length, and whether each has a contact sheet / transcript.",
      inputSchema: z.object({ projectId }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ projectId }: { projectId?: string }, ctx) => {
      const project = await resolveProject(agentUserId(ctx), projectId)
      const media = await listMedia(project.id)
      if (media.length === 0) return text(`"${project.name}" has no media yet. Add files with add_media_from_url, or ask the user to upload.`)
      return text(
        media
          .map(
            (m) =>
              `- ${describeMedia(m)}${m.kind === "video" ? (m.contactSheetUrl ? " · contact sheet" : " · no contact sheet") : ""}${m.kind !== "image" ? (m.transcriptSource ? ` · transcript (${m.transcriptSource})` : " · no transcript") : ""}`
          )
          .join("\n")
      )
    })
  )

  server.registerTool(
    "get_media",
    {
      title: "Look at a media file",
      description:
        "Details of one file, plus what it looks like: a video's contact sheet (12 frames with their source times) or the image itself. Call it before editing anything that uses a video.",
      inputSchema: z.object({ mediaId: z.string().min(1).max(64).describe("From list_media or a clip's mediaId.") }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ mediaId }: { mediaId: string }, ctx) => {
      const row = await getUserMedia(agentUserId(ctx), mediaId)
      if (!row) throw new AgentError(`No media file "${mediaId}". list_media shows the ids.`)

      const lines = [describeMedia(row)]
      let image: CallToolResult["content"][number] | null = null
      if (row.kind === "video") {
        image = row.contactSheetUrl ? await imageContent(row.contactSheetUrl) : null
        lines.push(
          image
            ? "Contact sheet below: 12 frames spread from start to end, each labelled with its time in the source."
            : "No contact sheet for this video (it was added from a URL, or the browser couldn't read it). Rely on the transcript and its name."
        )
      } else if (row.kind === "image") {
        image = await imageContent(row.thumbnailUrl ?? row.url)
        if (!image) lines.push("(Couldn't load a preview of the image.)")
      }
      if (row.kind !== "image") {
        lines.push(row.transcript ? `Transcript: yes (${row.transcript.source}); read it with get_media_transcript.` : "Transcript: none yet.")
      }
      return { content: [{ type: "text", text: lines.join("\n") }, ...(image ? [image] : [])] }
    })
  )

  server.registerTool(
    "get_media_transcript",
    {
      title: "Get a media file's transcript",
      description: [
        "What is said in an uploaded video or audio file, as timed lines: [m:ss.s–m:ss.s] text, with chapters first when there are any.",
        "Times are seconds into the source file. A clip plays its source from trimStart, so timeline second T on a clip that starts at `at` is source second T − at + trimStart.",
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
    handled(async ({ mediaId, from, to }: { mediaId: string; from?: number; to?: number }, ctx) => {
      const row = await getUserMedia(agentUserId(ctx), mediaId)
      if (!row) throw new AgentError(`No media file "${mediaId}" in your projects. Check the clip's mediaId.`)

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
      if (body.length <= MAX_TRANSCRIPT_CHARS) return text(`${header}\n\n${body}`)
      // Cut at a line break so no line is half-shown.
      const cut = body.slice(0, body.lastIndexOf("\n", MAX_TRANSCRIPT_CHARS))
      return text(`${header}\n\n${cut}\n\n[Transcript continues. Call again with \`from\` set to the last time shown to read the rest.]`)
    })
  )

  server.registerTool(
    "add_media_from_url",
    {
      title: "Add a file from a URL",
      description:
        "Brings a video, image or audio file into the project (stored on ImageKit), so clips can use it. Use a direct file URL (the file itself, not a web page), e.g. a Pexels/Pixabay download link (≤ 720p video) or an svgl.app SVG. Returns the new mediaId.",
      inputSchema: z.object({
        url: z.url().describe("Direct link to the file."),
        name: z.string().min(1).max(200).optional().describe('A file name with extension, e.g. "city-night.mp4". Default: from the URL.'),
        projectId,
      }),
    },
    handled(async ({ url, name, projectId }: { url: string; name?: string; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const fileName = (name ?? decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") ?? "").trim() || "file"
      const input = await uploadFromUrl(url, fileName.slice(0, 200), userId, project.id)
      const media = await createMedia(userId, project.id, input)
      await publish(projectChannel(project.id), { type: "media", mediaId: media.id })
      return text(`Added ${describeMedia(media)}. Use mediaId "${media.id}" in add_clip (kind "media").`)
    })
  )
}
