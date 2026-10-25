import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { describeProject } from "@/lib/agent/describe"
import { getEditorState } from "@/lib/agent/editor-state"
import { resolveProject } from "@/lib/agent/resolve"
import { changeFormatOps } from "@/lib/project/edit"
import { FORMAT_ORDER, FPS, MAX_SECONDS } from "@/lib/project/formats"
import type { Op } from "@/lib/project/ops"
import { createProject, listProjects } from "@/lib/projects"
import { formatTimestamp } from "@/lib/transcript"
import type { ProjectFormat } from "@/types/project"

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "The user's projects, newest first, with ids.",
      // An (empty) input schema keeps every handler's signature (args, ctx).
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    handled(async (_args: Record<string, never>, ctx) => {
      const projects = await listProjects(agentUserId(ctx))
      if (projects.length === 0) return text("No projects yet. The user creates them from the dashboard.")
      return text(projects.map((p) => `- ${p.id} · "${p.name}" · ${p.format} · ${formatTimestamp(p.durationInFrames / p.fps)}`).join("\n"))
    })
  )

  server.registerTool(
    "get_selection",
    {
      title: 'What "this" is',
      description: 'The project open in the user\'s editor and the selected clip, i.e. what "this" means.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    handled(async (_args: Record<string, never>, ctx) => {
      const userId = agentUserId(ctx)
      const state = await getEditorState(userId)
      if (!state.projectId) return text("No project is open in the editor. Ask the user to open one, or use list_projects.")
      const project = await resolveProject(userId, state.projectId)
      const clip = project.doc.clips.find((c) => c.id === state.selectedClipId)
      return text(
        `Open project: "${project.name}" (id ${project.id}, ${project.format}).\n` +
          (clip ? `"this" = clip ${clip.id} (${clip.type} "${clip.name}"). Call get_project for details.` : '"this" = nothing selected (the whole project).')
      )
    })
  )

  server.registerTool(
    "get_project",
    {
      title: "Get a project",
      description:
        "A project's tracks and clips (top track first; ids, times in seconds and frames, boxes, what each clip shows) followed by the full doc as JSON.",
      inputSchema: z.object({ projectId }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ projectId }: { projectId?: string }, ctx) => {
      const userId = agentUserId(ctx)
      const project = await resolveProject(userId, projectId)
      const { selectedClipId } = await getEditorState(userId)
      return text(`${describeProject(project, selectedClipId)}\n\nFull doc (JSON):\n${JSON.stringify(project.doc)}`)
    })
  )

  const format = z.enum(FORMAT_ORDER as [ProjectFormat, ...ProjectFormat[]]).describe("16:9 landscape, 9:16 vertical, 1:1 square.")

  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description: "Creates a new, empty project. The user opens it from the dashboard (tell them its name).",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(80),
        format,
        seconds: z.number().int().min(1).max(MAX_SECONDS).default(15).describe("Starting length; it then follows the clips."),
      }),
    },
    handled(async ({ name, format, seconds }: { name: string; format: ProjectFormat; seconds: number }, ctx) => {
      const project = await createProject(agentUserId(ctx), { name, format, durationSeconds: seconds })
      return text(`Created "${project.name}" (id ${project.id}, ${project.format}). Pass projectId "${project.id}" to edit it before the user opens it.`)
    })
  )

  server.registerTool(
    "update_project",
    {
      title: "Change a project",
      description:
        "Renames it, changes its format (clips are refitted to the new canvas, like the editor's ratio menu), or sets its length. The length follows the clips, so `seconds` only matters while the project is empty.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(80).optional(),
        format: format.optional(),
        seconds: z.number().min(1).max(MAX_SECONDS).optional(),
        projectId,
      }),
    },
    handled(
      async ({ name, format, seconds, projectId }: { name?: string; format?: ProjectFormat; seconds?: number; projectId?: string }, ctx) => {
        if (name === undefined && format === undefined && seconds === undefined) throw new AgentError("Nothing to change: pass name, format or seconds.")
        const userId = agentUserId(ctx)
        const project = await resolveProject(userId, projectId)
        const result = await applyAgentEdit(userId, project.id, (state) => {
          const ops: Op[] = []
          if (name !== undefined && name !== state.name) ops.push({ type: "updateProject", patch: { name } })
          if (format !== undefined) ops.push(...(changeFormatOps(state, format) ?? []))
          if (seconds !== undefined) ops.push({ type: "updateProject", patch: { durationInFrames: Math.round(seconds * FPS) } })
          return ops
        })
        const { name: newName, format: newFormat, durationInFrames } = result.data
        return text(`"${newName}" is now ${newFormat}, ${formatTimestamp(durationInFrames / FPS)} long.`)
      }
    )
  )
}
