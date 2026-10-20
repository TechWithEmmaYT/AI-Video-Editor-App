import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { addClipOps, addClipSchema, updateClipOps, updateClipSchema, type AddClipSpec, type UpdateClipChanges } from "@/lib/agent/clip-spec"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { resolveClip, resolveProject } from "@/lib/agent/resolve"
import { listElements } from "@/lib/elements"
import { findBuiltinElement } from "@/lib/elements/builtin"
import { getUserMedia } from "@/lib/media-transcript"
import { splitClipOps } from "@/lib/project/edit"
import { FPS } from "@/lib/project/formats"
import { formatTimestamp } from "@/lib/transcript"

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")
const clipId = z.string().min(1).max(64).describe('A clip id from get_project, or "this" for the clip selected in the editor.')

export function registerClipTools(server: McpServer) {
  server.registerTool(
    "add_clip",
    {
      title: "Add a clip",
      description: [
        "Adds one clip. kind: media (a mediaId from list_media), text (with a preset), element (a built-in or saved element), or code (your own canvas code).",
        'Times are seconds. track "auto" puts audio on the bottom audio track and visuals on the top track that\'s free at that time.',
        "Returns the new clip id. The user sees it appear live.",
      ].join(" "),
      inputSchema: z.object({ clip: addClipSchema, projectId }),
    },
    handled(async ({ clip: spec, projectId }: { clip: AddClipSpec; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)

      const media = spec.kind === "media" ? await getUserMedia(userId, spec.mediaId) : null
      if (spec.kind === "media" && media?.projectId !== project.id) {
        throw new AgentError(`No media file "${spec.mediaId}" in this project. list_media shows them; add_media_from_url brings new ones in.`)
      }
      const element =
        spec.kind === "element" ? (findBuiltinElement(spec.elementId) ?? (await listElements(userId)).find((e) => e.id === spec.elementId) ?? null) : null

      let added = ""
      const result = await applyAgentEdit(userId, project.id, (state) => {
        const { ops, clipId } = addClipOps(state, spec, { width: project.width, height: project.height, newId: () => crypto.randomUUID(), media, element })
        added = clipId
        return ops
      })
      const clip = result.data.doc.clips.find((c) => c.id === added)!
      const track = result.data.doc.tracks.findIndex((t) => t.id === clip.trackId) + 1
      return text(
        `Added ${clip.type} clip ${clip.id} "${clip.name}" on track ${track} (${clip.trackId}), ${formatTimestamp(clip.from / project.fps)}–${formatTimestamp((clip.from + clip.durationInFrames) / project.fps)}.`
      )
    })
  )

  server.registerTool(
    "update_clip",
    {
      title: "Change a clip",
      description:
        "Changes fields of one clip: timing (at, duration, trimStart, in seconds), trackId, box (merged), text style, volume/fit/radius, fades, code clip params (merged) or code. Leave out what you don't change.",
      inputSchema: z.object({ clipId, changes: updateClipSchema, projectId }),
    },
    handled(async ({ clipId, changes, projectId }: { clipId: string; changes: UpdateClipChanges; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const target = await resolveClip(userId, project.doc.clips, clipId)
      await applyAgentEdit(userId, project.id, (state) => {
        const clip = state.doc.clips.find((c) => c.id === target.id)
        if (!clip) throw new AgentError("That clip was just deleted.")
        return updateClipOps(clip, changes)
      })
      return text(`Updated clip ${target.id} "${target.name}". Call get_project to see the result.`)
    })
  )

  server.registerTool(
    "delete_clip",
    {
      title: "Delete a clip",
      description: "Removes one clip (its track goes too if it's left empty).",
      inputSchema: z.object({ clipId, projectId }),
      annotations: { destructiveHint: true },
    },
    handled(async ({ clipId, projectId }: { clipId: string; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const target = await resolveClip(userId, project.doc.clips, clipId)
      await applyAgentEdit(userId, project.id, (state) =>
        state.doc.clips.some((c) => c.id === target.id) ? [{ type: "removeClip", clipId: target.id }] : []
      )
      return text(`Deleted clip ${target.id} "${target.name}".`)
    })
  )

  server.registerTool(
    "split_clip",
    {
      title: "Split a clip",
      description:
        "Cuts a clip in two at a timeline time (seconds). Video/audio keep playing the right part of the source in both halves. Returns both ids.",
      inputSchema: z.object({
        clipId,
        atSeconds: z.number().min(0).describe("Timeline time to cut at; must fall inside the clip."),
        projectId,
      }),
    },
    handled(async ({ clipId, atSeconds, projectId }: { clipId: string; atSeconds: number; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const target = await resolveClip(userId, project.doc.clips, clipId)
      let newClipId = ""
      await applyAgentEdit(userId, project.id, (state) => {
        const result = splitClipOps(state, target.id, Math.round(atSeconds * FPS), () => crypto.randomUUID())
        if (!result) throw new AgentError(`${formatTimestamp(atSeconds)} isn't inside clip ${target.id} (it runs ${formatTimestamp(target.from / FPS)}–${formatTimestamp((target.from + target.durationInFrames) / FPS)}).`)
        newClipId = result.newClipId
        return result.ops
      })
      return text(`Split ${target.id} at ${formatTimestamp(atSeconds)}: the first part keeps id ${target.id}, the second is ${newClipId}.`)
    })
  )
}
