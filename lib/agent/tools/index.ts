import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"

import { registerClipTools } from "@/lib/agent/tools/clips"
import { registerElementTools } from "@/lib/agent/tools/elements"
import { registerGuideTool } from "@/lib/agent/tools/guide"
import { registerMediaTools } from "@/lib/agent/tools/media"
import { registerProjectTools } from "@/lib/agent/tools/projects"
import { registerSectionTools } from "@/lib/agent/tools/sections"

/** Every tool Claude Code gets over MCP (see the plan, §8). The guide lists whatever is registered here. */
export function registerAgentTools(server: McpServer) {
  const names: string[] = []
  // Record each tool's name as it's registered, so get_guide can list exactly what exists.
  const recording = new Proxy(server, {
    get(target, key, receiver) {
      if (key === "registerTool") {
        return (name: string, ...rest: unknown[]) => {
          names.push(name)
          return (target.registerTool as (...args: unknown[]) => unknown).call(target, name, ...rest)
        }
      }
      return Reflect.get(target, key, receiver)
    },
  })

  registerGuideTool(recording, () => names)
  registerProjectTools(recording)
  registerMediaTools(recording)
  registerClipTools(recording)
  registerSectionTools(recording)
  registerElementTools(recording)
}
