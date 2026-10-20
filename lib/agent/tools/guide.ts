import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { handled, text, toolError } from "@/lib/agent/context"
import { GUIDE_TOPICS, guide } from "@/lib/agent/guide"

export function registerGuideTool(server: McpServer, tools: () => string[]) {
  server.registerTool(
    "get_guide",
    {
      title: "Read the motion guide",
      description:
        "How motion works and how to edit well: call this first in every conversation. Without a topic: the overview (rules, topics, styles, tools). Topics: " +
        GUIDE_TOPICS.join(", ") +
        ", or brief:<id> for a style's full steps.",
      inputSchema: z.object({
        topic: z.string().max(60).optional().describe('e.g. "code-clips", "elements", "brief:reel-captions". Leave out for the overview.'),
      }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ topic }: { topic?: string }) => {
      const body = guide(topic ?? "overview", tools())
      return body ? text(body) : toolError(`No guide topic "${topic}". Topics: ${GUIDE_TOPICS.join(", ")}, or brief:<id>.`)
    })
  )
}
