import "server-only"

import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"

import { applyAgentEdit } from "@/lib/agent/apply"
import { addClipOps, addClipSchema, boxSchema, trackChoice } from "@/lib/agent/clip-spec"
import { AgentError, agentUserId, handled, text } from "@/lib/agent/context"
import { guide } from "@/lib/agent/guide"
import { resolveProject } from "@/lib/agent/resolve"
import { validateCode } from "@/lib/code-clips/validate"
import { createElement, listElements } from "@/lib/elements"
import { BUILTIN_ELEMENTS, findBuiltinElement } from "@/lib/elements/builtin"
import { ELEMENT_CATEGORIES, ELEMENT_LAYOUTS, type ElementDef } from "@/lib/elements/types"
import { saveElementSchema } from "@/lib/elements/validation"
import { FPS, MAX_SECONDS } from "@/lib/project/formats"
import { paramDefSchema } from "@/lib/project/schema"
import { formatTimestamp } from "@/lib/transcript"

const projectId = z.string().min(1).max(64).optional().describe("Defaults to the project open in the editor.")
const categoryIds = ELEMENT_CATEGORIES.map((c) => c.id) as [string, ...string[]]

const describeElement = (e: ElementDef) =>
  `- ${e.id} · "${e.name}" · ${e.category} · layout ${e.layout} · ${(e.defaultDurationInFrames / FPS).toFixed(1)} s` +
  (e.createdBy === "builtin" ? "" : e.createdBy === "claude" ? " · saved by you (Claude)" : " · saved by the user") +
  (e.paramSchema.length ? `\n  params: ${e.paramSchema.map((p) => `${p.key} (${p.type}) = ${JSON.stringify(p.default)}`).join(", ")}` : "")

/** A built-in, or one of the user's saved elements. */
async function findElement(userId: string, id: string) {
  return findBuiltinElement(id) ?? (await listElements(userId)).find((e) => e.id === id) ?? null
}

export function registerElementTools(server: McpServer) {
  server.registerTool(
    "list_elements",
    {
      title: "List elements",
      description: "Built-in elements (animated titles, captions, lower thirds, logos, backgrounds, transitions, callouts) and the user's saved ones, with their params.",
      inputSchema: z.object({
        category: z.enum([...categoryIds, "mine"] as [string, ...string[]]).optional(),
        query: z.string().max(80).optional().describe("Matches the name or category."),
      }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ category, query }: { category?: string; query?: string }, ctx) => {
      const mine = await listElements(agentUserId(ctx))
      const pool = category === "mine" ? mine : [...BUILTIN_ELEMENTS, ...mine]
      const search = query?.trim().toLowerCase()
      const found = pool.filter(
        (e) => (!category || category === "mine" || e.category === category) && (!search || e.name.toLowerCase().includes(search) || e.category.includes(search))
      )
      return text(found.length ? found.map(describeElement).join("\n") : "No elements match.")
    })
  )

  server.registerTool(
    "get_element",
    {
      title: "Get an element's code",
      description: "An element's code (a code clip body), params schema, defaults, fonts and layout: read one before writing similar code.",
      inputSchema: z.object({ elementId: z.string().min(1).max(64) }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ elementId }: { elementId: string }, ctx) => {
      const element = await findElement(agentUserId(ctx), elementId)
      if (!element) throw new AgentError(`No element "${elementId}". list_elements shows them.`)
      return text(
        `${describeElement(element)}\nfonts: ${element.fonts.join(", ") || "none"}\n\nparamSchema (JSON): ${JSON.stringify(element.paramSchema)}\ndefaultParams (JSON): ${JSON.stringify(element.defaultParams)}\n\ncode:\n\`\`\`js\n${element.code}\n\`\`\``
      )
    })
  )

  server.registerTool(
    "save_element",
    {
      title: "Save an element",
      description:
        'Saves a reusable element (a code clip) to the user\'s "Mine" list, marked as made by Claude. The code is checked first; errors come back with their line. See get_guide topic "code-clips".',
      inputSchema: z.object({
        name: z.string().trim().min(1).max(80),
        category: z.enum(categoryIds),
        code: z.string().min(1).max(20_000),
        paramSchema: z.array(paramDefSchema).max(40).default([]).describe("Each param: key, label, type (number/color/text/select/boolean/font/image), default, and min/max/step/options when useful."),
        defaultParams: z.record(z.string(), z.unknown()).default({}),
        fonts: z.array(z.string().max(100)).max(10).default([]),
        layout: z.enum(ELEMENT_LAYOUTS as [string, ...string[]]).default("callout").describe("Where its box goes when added: full, title, caption, lower-third, square, callout."),
        seconds: z.number().min(0.1).max(MAX_SECONDS).default(3).describe("Default length when added."),
      }),
    },
    handled(async (args: { name: string; category: string; code: string; paramSchema: unknown[]; defaultParams: Record<string, unknown>; fonts: string[]; layout: string; seconds: number }, ctx) => {
      const parsed = saveElementSchema.safeParse({ ...args, defaultDurationInFrames: Math.max(1, Math.round(args.seconds * FPS)) })
      if (!parsed.success) throw new AgentError(parsed.error.issues[0]?.message ?? "Invalid element.")
      const element = await createElement(agentUserId(ctx), parsed.data, "claude")
      return text(`Saved element ${element.id} "${element.name}" to Mine. Add it with add_element (elementId "${element.id}").`)
    })
  )

  server.registerTool(
    "add_element",
    {
      title: "Add an element",
      description: "Adds an element (built-in or saved) as a clip: a shortcut for add_clip with kind \"element\". Returns the new clip id.",
      inputSchema: z.object({
        elementId: z.string().min(1).max(64),
        at: z.number().min(0).max(MAX_SECONDS).default(0).describe("Start on the timeline, in seconds."),
        duration: z.number().min(0).max(MAX_SECONDS).optional().describe("Seconds. Default: the element's."),
        params: z.record(z.string(), z.unknown()).optional(),
        box: boxSchema.optional(),
        track: trackChoice,
        projectId,
      }),
    },
    handled(
      async (
        args: { elementId: string; at: number; duration?: number; params?: Record<string, unknown>; box?: Record<string, number>; track: string; projectId?: string },
        ctx
      ) => {
        const userId = agentUserId(ctx)
        const project = await resolveProject(userId, args.projectId)
        const element = await findElement(userId, args.elementId)
        if (!element) throw new AgentError(`No element "${args.elementId}". list_elements shows them.`)
        const spec = addClipSchema.parse({ kind: "element", elementId: args.elementId, at: args.at, duration: args.duration, params: args.params, box: args.box, track: args.track })
        let added = ""
        const result = await applyAgentEdit(userId, project.id, (state) => {
          const { ops, clipId } = addClipOps(state, spec, { width: project.width, height: project.height, newId: () => crypto.randomUUID(), element })
          added = clipId
          return ops
        })
        const clip = result.data.doc.clips.find((c) => c.id === added)!
        return text(`Added "${element.name}" as clip ${clip.id}, ${formatTimestamp(clip.from / FPS)}–${formatTimestamp((clip.from + clip.durationInFrames) / FPS)}.`)
      }
    )
  )

  server.registerTool(
    "validate_code",
    {
      title: "Check code-clip code",
      description: "Dry-runs the code-clip validator on a code body without saving anything: OK, or the first problem with its line and column.",
      inputSchema: z.object({ code: z.string().max(20_000) }),
      annotations: { readOnlyHint: true },
    },
    handled(async ({ code }: { code: string }) => {
      const error = validateCode(code)
      if (!error) return text("OK: the code passes the validator.")
      const line = code.split("\n")[error.line - 1] ?? ""
      return text(`Problem at line ${error.line}, column ${error.column}: ${error.message}\n\n${error.line} | ${line}\n${" ".repeat(String(error.line).length + 3 + error.column)}^`)
    })
  )

  server.registerTool(
    "get_code_clip_guide",
    {
      title: "Code-clip guide",
      description: "The code-clip contract (ctx, t, u, w, h, p, M), the helpers M, what's allowed, the limits and an example. Same as get_guide topic \"code-clips\".",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    handled(async () => text(guide("code-clips", [])!))
  )
}
