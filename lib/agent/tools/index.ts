import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"

import { registerCaptionTools } from "@/lib/agent/tools/captions"
import { registerClipTools } from "@/lib/agent/tools/clips"
import { registerElementTools } from "@/lib/agent/tools/elements"
import { registerFrameTools } from "@/lib/agent/tools/frames"
import { registerGuideTool } from "@/lib/agent/tools/guide"
import { registerMediaTools } from "@/lib/agent/tools/media"
import { registerProjectTools } from "@/lib/agent/tools/projects"
import { registerSectionTools } from "@/lib/agent/tools/sections"
import { registerSoundTools } from "@/lib/agent/tools/sounds"

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
  registerCaptionTools(recording)
  registerSectionTools(recording)
  registerElementTools(recording)
  registerFrameTools(recording)
  registerSoundTools(recording)
}
