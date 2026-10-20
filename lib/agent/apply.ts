import "server-only"

import { AgentError } from "@/lib/agent/context"
import { withDurationFit, withEmptyTrackCleanup, type Op, type ProjectData } from "@/lib/project/ops"
import { applyProjectOps } from "@/lib/projects"

/**
 * Saves Claude's edit like any other: validated (doc + code clips), version-locked, and published
 * to the open editor live. Like the editor, it drops tracks the edit emptied and fits the
 * project's length to its clips. `build` gets the latest state (it may run again on a retry).
 */
export async function applyAgentEdit(userId: string, projectId: string, build: (state: ProjectData) => Op[]) {
  const result = await applyProjectOps(
    userId,
    projectId,
    (state) => {
      const ops = build(state)
      return ops.length ? withDurationFit(state, withEmptyTrackCleanup(state, ops)) : ops
    },
    { clientId: "claude", source: "claude" }
  )
  switch (result.status) {
    case "ok":
      return result
    case "not-found":
      throw new AgentError("That project no longer exists.")
    case "invalid":
      throw new AgentError(`That edit isn't valid: ${result.message}`)
    case "conflict":
      throw new AgentError("The project changed while saving. Try the edit again.")
  }
}
