import { describe, expect, it } from "vitest"

import { BRIEFS } from "@/lib/agent/briefs"
import { describeProject } from "@/lib/agent/describe"
import { AGENT_INSTRUCTIONS, GUIDE_TOPICS, guide, HELPER_DOCS } from "@/lib/agent/guide"
import { createHelpers } from "@/lib/code-clips/helpers"
import { BUILTIN_ELEMENTS } from "@/lib/elements/builtin"
import { imageClip, project } from "@/tests/fixtures"

describe("guide", () => {
  it("renders every topic and every brief", () => {
    for (const topic of GUIDE_TOPICS) expect(guide(topic, ["get_guide"]), topic).toBeTruthy()
    for (const brief of BRIEFS) expect(guide(`brief:${brief.id}`, [])).toBe(brief.body)
    expect(guide("nope", [])).toBeNull()
  })

  it("documents exactly the helpers code clips get", () => {
    expect(HELPER_DOCS.map(([name]) => name).sort()).toEqual(Object.keys(createHelpers(() => {})).sort())
  })

  it("lists every built-in element and the tools that exist", () => {
    const elements = guide("elements", [])!
    for (const e of BUILTIN_ELEMENTS) expect(elements).toContain(`\`${e.id}\``)
    expect(guide("overview", ["get_guide", "add_clip"])).toContain("`add_clip`")
    expect(AGENT_INSTRUCTIONS).toContain("get_guide")
  })
})

describe("describeProject", () => {
  it("summarises tracks top to bottom with times in seconds and frames, and what 'this' is", () => {
    const state = project({ tracks: [{ id: "t1" }], clips: [imageClip({ id: "c1", trackId: "t1", from: 30, durationInFrames: 45 })] })
    const summary = describeProject({ id: "p1", width: 1920, height: 1080, fps: 30, version: 3, ...state }, "c1")
    expect(summary).toContain('"this" = c1 (image "Still")')
    expect(summary).toContain("1. track t1 (1 clip)")
    expect(summary).toContain("c1 · image \"Still\" · 0:01.0–0:02.5 (frames 30–75)")
  })
})
