import "server-only"

import { AgentError } from "@/lib/agent/context"
import { getEditorState } from "@/lib/agent/editor-state"
import type { Clip } from "@/lib/project/schema"
import { getProjectWithDoc } from "@/lib/projects"

/** The project a tool acts on: the one passed, else the one open in the editor (see the plan, §8). */
export async function resolveProject(userId: string, projectId?: string) {
  const id = projectId ?? (await getEditorState(userId)).projectId
  if (!id) throw new AgentError("Open a project first, or pass projectId. (list_projects shows them.)")
  const project = await getProjectWithDoc(userId, id)
  if (!project) throw new AgentError(`No project with id "${id}" in your account.`)
  return project
}

/** A clip by id, or "this": the clip selected in the editor. */
export async function resolveClip(userId: string, clips: Clip[], clipId: string) {
  let id = clipId
  if (clipId === "this") {
    const { selectedClipId } = await getEditorState(userId)
    if (!selectedClipId) throw new AgentError('Nothing is selected in the editor, so there\'s no "this". Pass a clipId (get_project lists them).')
    id = selectedClipId
  }
  const clip = clips.find((c) => c.id === id)
  if (!clip) throw new AgentError(`No clip with id "${id}" in this project. get_project lists the clips.`)
  return clip
}
