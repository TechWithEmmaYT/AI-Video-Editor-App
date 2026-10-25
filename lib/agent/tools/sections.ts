import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { resolveProject } from "@/lib/agent/resolve"
import { FPS, MAX_SECONDS } from "@/lib/project/formats"
import { nextSectionColor } from "@/lib/project/sections"
import { formatTimestamp } from "@/lib/transcript"

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")
const seconds = z.number().min(0).max(MAX_SECONDS)
const color = z.string().max(32).describe('CSS colour, e.g. "#8b5cf6". Default: the next in the palette.')
const frames = (s: number) => Math.round(s * FPS)

export function registerSectionTools(server: McpServer) {
  server.registerTool(
    "add_section",
    {
      title: "Add a section",
      description: "Adds a named time range above the tracks (a chapter or beat), from/to in seconds.",
      inputSchema: z.object({ name: z.string().trim().min(1).max(100), from: seconds, to: seconds, color: color.optional(), projectId }),
    },
    handled(async ({ name, from, to, color, projectId }: { name: string; from: number; to: number; color?: string; projectId?: string }, ctx) => {
      if (to <= from) throw new AgentError("`to` must be after `from`.")
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const id = crypto.randomUUID()
      await applyAgentEdit(userId, project.id, (state) => [
        { type: "addSection", section: { id, name, from: frames(from), to: frames(to), color: color ?? nextSectionColor(state.doc.sections.length) } },
      ])
      return text(`Added section ${id} "${name}", ${formatTimestamp(from)}–${formatTimestamp(to)}.`)
    })
  )

  server.registerTool(
    "update_section",
    {
      title: "Change a section",
      description: "Renames, retimes (seconds) or recolours a section. Leave out what you don't change.",
      inputSchema: z.object({
        sectionId: z.string().min(1).max(64).describe("From get_project."),
        changes: z.object({ name: z.string().trim().min(1).max(100), from: seconds, to: seconds, color }).partial(),
        projectId,
      }),
    },
    handled(
      async (
        { sectionId, changes, projectId }: { sectionId: string; changes: { name?: string; from?: number; to?: number; color?: string }; projectId?: string },
        ctx
      ) => {
        const userId = agentUserId(ctx)
        const project = await resolveProject(userId, projectId)
        if (!project.doc.sections.some((s) => s.id === sectionId)) throw new AgentError(`No section "${sectionId}". get_project lists them.`)
        const patch: Record<string, unknown> = {}
        if (changes.name !== undefined) patch.name = changes.name
        if (changes.color !== undefined) patch.color = changes.color
        if (changes.from !== undefined) patch.from = frames(changes.from)
        if (changes.to !== undefined) patch.to = frames(changes.to)
        if (Object.keys(patch).length === 0) throw new AgentError("Nothing to change: pass at least one field.")
        await applyAgentEdit(userId, project.id, () => [{ type: "updateSection", sectionId, patch }])
        return text(`Updated section ${sectionId}.`)
      }
    )
  )

  server.registerTool(
    "delete_section",
    {
      title: "Delete a section",
      description: "Removes a section (clips are untouched).",
      inputSchema: z.object({ sectionId: z.string().min(1).max(64), projectId }),
      annotations: { destructiveHint: true },
    },
    handled(async ({ sectionId, projectId }: { sectionId: string; projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      if (!project.doc.sections.some((s) => s.id === sectionId)) throw new AgentError(`No section "${sectionId}". get_project lists them.`)
      await applyAgentEdit(userId, project.id, () => [{ type: "removeSection", sectionId }])
      return text(`Deleted section ${sectionId}.`)
    })
  )
}
