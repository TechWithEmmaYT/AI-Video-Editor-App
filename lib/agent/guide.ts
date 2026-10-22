import { BRIEFS, findBrief } from "@/lib/agent/briefs"
import { REEL_REFERENCES } from "@/lib/agent/briefs/talking-head"
import { MAX_FRAME_MS, MAX_TICKS } from "@/lib/code-clips/compile"
import { BANNED_PROPERTIES, CODE_PARAMS, MAX_CODE_BYTES, SAFE_GLOBALS } from "@/lib/code-clips/validate"
import { BUILTIN_ELEMENTS } from "@/lib/elements/builtin"
import { FONTS } from "@/lib/fonts"
import { FORMAT_ORDER, FORMATS, FPS, MAX_SECONDS } from "@/lib/project/formats"
import { TEXT_PRESETS } from "@/lib/project/text-presets"

/*
 * get_guide's content (see the plan, §8). Hand-written: the workflow, rules and recipes. Generated
 * from the code, so it can't go stale: elements, helpers' names, fonts, formats, the validator's
 * lists and limits, briefs, and which tools exist.
 */

/** Sent to Claude Code when it connects (MCP `instructions`), so it starts with the guide. */
export const AGENT_INSTRUCTIONS = [
  "motion is a video editor; you edit the user's projects live through these tools.",
  "Start every conversation by calling get_guide (once), then get_selection or get_project.",
  "Before editing anything that involves a video, call get_media on it to see it (and get_media_transcript to know what's said).",
  "Times in tools are seconds. Never put outside URLs in clips: bring files in with add_media_from_url first.",
  "Before you start a look, find references on Pinterest first (get_guide topic \"assets\").",
  "Edits appear in the user's open editor as you make them; make them in small steps.",
  "You can see your work: after each round of edits call render_frames, look at the frames, fix what's wrong and render again, until it looks right. Never call a video done without looking at it.",
].join(" ")

export const GUIDE_TOPICS = ["overview", "project", "workflow", "code-clips", "elements", "briefs", "assets", "recipes"] as const

/** A small Markdown table. */
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n")

/** The helpers `M` gives code clips (a test checks this matches createHelpers). */
export const HELPER_DOCS: [name: string, signature: string][] = [
  ["lerp", "lerp(a, b, k) → a + (b − a)·k"],
  ["clamp", "clamp(v, lo = 0, hi = 1)"],
  ["map", "map(v, inA, inB, outA = 0, outB = 1, clamp = true)"],
  ["ease", "ease.linear/in/out/inOut/inCubic/outCubic/inOutCubic/outQuint/inOutQuint/outExpo/inOutExpo/outBack/inOutBack/outElastic/outBounce (k) → 0–1"],
  ["spring", "spring(u, { damping = 6, frequency = 1.6 }) → springy 0 → 1 (overshoots)"],
  ["rand", "rand(seed) → repeatable 0–1 (never Math.random: frames must render the same every time)"],
  ["noise2", "noise2(x, y) → smooth 0–1"],
  ["roundRect", "roundRect(ctx, x, y, w, h, r): adds a rounded rect path (then ctx.fill()/stroke())"],
  ["fitText", "fitText(ctx, text, maxW, size) → shrinks ctx.font until text fits; returns the size used"],
  ["font", 'font(family, weight = 400, size = 32, style = "normal" | "italic") → a ctx.font string'],
  ["mix", "mix(colorA, colorB, k) → rgba string"],
  ["alpha", "alpha(color, a) → rgba string"],
  ["path", "path(svgPathData) → Path2D (cached)"],
  ["image", "image(imagekitUrl) → ImageBitmap, or null until loaded (ImageKit URLs only)"],
  ["svg", "svg(markup) → drawable image, or null until decoded (sanitised; drawn as an image)"],
]

function overview(tools: string[]) {
  return `# motion: guide for Claude

**motion** is a browser video editor. A project is one video: a canvas (${FORMAT_ORDER.map((f) => `${f} ${FORMATS[f].width}×${FORMATS[f].height}`).join(", ")}), ${FPS} fps, up to ${MAX_SECONDS} s. You edit it live; the user sees each change in their open editor.

## Rules
1. Start with \`get_selection\` (what's open, what "this" is) or \`get_project\`.
2. **Look before you edit:** \`get_media\` on any video you're working with (contact sheet), \`get_media_transcript\` for what's said.
3. Times in tools are **seconds**. Positions and sizes are canvas pixels (top-left is 0,0).
4. Never put outside URLs in clips: \`add_media_from_url\` first, then use its mediaId.
5. **References first:** before you design a look, search Pinterest for edits like the one asked for (\`get_guide({ topic: "assets" })\`) and match what you find.
6. **Look at what you made:** after every round of edits call \`render_frames\` and look at the frames. Fix what's wrong, render again, and repeat until the frames are clean. Never say a video is done without looking at it.
7. Work in small steps. Your edits aren't in the user's undo history, so confirm big changes first.

## Topics
Call \`get_guide({ topic })\` for: ${GUIDE_TOPICS.filter((t) => t !== "overview").map((t) => `\`${t}\``).join(", ")}, or \`brief:<id>\` for a style.

## Styles (briefs)
${BRIEFS.map((b) => `- \`brief:${b.id}\`: **${b.name}** (${b.formats.join(", ")}): ${b.summary}`).join("\n")}

## Tools available now
${tools.map((t) => `\`${t}\``).join(", ")}`
}

const project = () => `# How a project works

- **Tracks** are rows; **the top track draws on top**. Clips on one track can't overlap; tracks are created as needed and removed when emptied.
- **Clips** have a start and length (tools use seconds; the doc stores frames at ${FPS} fps), and a **box** (\`transform\`: x, y, width, height in canvas pixels, plus scale, rotation°, opacity 0–1).
- **Clip types:** \`video\` (mediaId, trimStart = where in the source it starts, volume 0–2, fit cover/contain/fill, radius), \`image\` (fit, radius), \`audio\` (volume, fades), \`text\` (text, fontFamily, fontWeight, fontSize, color, align, letterSpacing, lineHeight), \`code\` (a canvas drawing function plus params; built-in **elements** are code clips).
- **Source → timeline time:** a video/audio clip plays its source from \`trimStart\`; timeline second T on a clip starting at \`at\` shows source second \`T − at + trimStart\`.
- **Sections** are named time ranges shown above the tracks (chapters, beats).
- **"this"** = the clip selected in the editor (\`get_selection\`); tools that take a clipId accept \`"this"\`.
- The project is exactly as long as its clips (it grows and shrinks to fit).

## Text presets (add_clip kind "text")
${table(["preset", "font", "use"], TEXT_PRESETS.map((p) => [p.id, `${p.fontFamily} ${p.fontWeight}`, p.name]))}

## Fonts
${FONTS.map((f) => `${f.family}${f.italics?.length ? " (+italic)" : ""}`).join(" · ")}`

const workflow = () => `# Editing workflow

1. **Orient:** \`get_selection\` → \`get_project\` (tracks, clips, ids, times).
2. **See and hear:** \`list_media\`; \`get_media\` on videos (contact sheet with timestamps); \`get_media_transcript\` for speech (word timings when ImageKit made it). If the timeline already has clips, \`render_frames\` shows how it looks now.
3. **Find references on Pinterest first, before you plan.** Search for edits like the one asked for (see \`get_guide({ topic: "assets" })\`), open 2–3 good ones and note what they do: caption size and place, colours, how often it cuts, how cards enter. Match that.
4. **Plan** against the timeline: which track, which seconds. Prefer a brief (\`get_guide({ topic: "briefs" })\`) when the request matches a style.
5. **Edit** with \`add_clip\` / \`update_clip\` / \`delete_clip\` (seconds; \`track: "auto"\` picks a sensible track).
6. **Look, fix, repeat.** This is a loop, not one check:
   1. \`render_frames\` over what you changed (\`clipId\` for one clip, \`from\`/\`to\` for a stretch, or the default 8 over the whole video).
   2. Look at every frame. Is the text readable, inside the safe zone, not cut off or covering a face? Is anything black, stretched, empty or overlapping by mistake? Does it look like your reference? Read the checks under the frames too.
   3. Fix each problem with \`update_clip\` / \`add_clip\` / \`delete_clip\`.
   4. \`render_frames\` again on the same times. Repeat until a round finds nothing to fix (stop after 5 rounds and tell the user what's left).
   5. Finish with one pass over the whole video (\`count: 12\`), and \`detail: true\` on anything small you need to read.
7. **Tell the user** what you made and what you checked.

Tips: add a whole caption/b-roll pass one clip per call, in time order. For a clip's exact values, \`get_project\` includes the full JSON. \`render_frames\` shows the saved project, so call it after your edits have returned.`

function codeClips() {
  return `# Code clips

A code clip is the **body** of \`function (ctx, t, u, w, h, p, M) { … }\`, run every frame on a canvas the size of the clip's box.
- \`ctx\`: CanvasRenderingContext2D (already cleared; reset every frame) · \`t\`: seconds since the clip started · \`u\`: progress 0–1 · \`w\`, \`h\`: box size in pixels · \`p\`: params (frozen) · \`M\`: helpers.
- The box's position, opacity and corner radius come from the clip, not the code. **The code only draws.**
- Must be deterministic (same frame → same pixels): no randomness except \`M.rand(seed)\`.

## Allowed
- Names: the parameters (${CODE_PARAMS.join(", ")}), your own locals, and ${[...SAFE_GLOBALS].join(", ")}.
- \`new\` only on Path2D, Array, Float32Array, Uint8ClampedArray. \`Object.\` only keys/values/entries/assign/freeze.
- Banned property names (dot or ["…"]): ${[...BANNED_PROPERTIES].join(", ")}.
- Not allowed: this, classes, async/await, generators, import, with, labels, getters/setters, tagged templates, assigning undeclared names, names starting with "__".
- Limits: ${MAX_CODE_BYTES / 1000} KB of code; a frame stops after ${MAX_TICKS.toLocaleString("en")} loop steps or ${MAX_FRAME_MS} ms.
- Errors come back with line and column: fix and retry. Declare fonts you use in \`fonts\` so they load first.

## Helpers (M)
${HELPER_DOCS.map(([, signature]) => `- \`${signature}\``).join("\n")}

## Example
\`\`\`js
const k = M.ease.outBack(M.clamp(t / 0.5))
ctx.fillStyle = p.color
M.roundRect(ctx, 0, 0, w * k, h, h / 2)
ctx.fill()
ctx.font = M.font("Inter", 800, h * 0.5)
ctx.fillStyle = "#fff"
ctx.textBaseline = "middle"
ctx.fillText(p.label, h * 0.4, h / 2)
\`\`\``
}

const elements = () => `# Built-in elements (add_clip kind "element")

Params are \`key: type = default\`; override them with \`params\`. Default box comes from the element's layout.

${BUILTIN_ELEMENTS.map(
  (e) =>
    `## ${e.name} · \`${e.id}\`\n${e.category}, layout \`${e.layout}\`, ${(e.defaultDurationInFrames / FPS).toFixed(1)} s\n${e.paramSchema.map((p) => `- ${p.key}: ${p.type} = ${JSON.stringify(p.default)}${p.options ? ` (${p.options.join("/")})` : ""}`).join("\n") || "- (no params)"}`
).join("\n\n")}`

const briefs = () => `# Styles (briefs)

Call \`get_guide({ topic: "brief:<id>" })\` for the full steps.

${BRIEFS.map((b) => `- \`${b.id}\`: **${b.name}** (${b.formats.join(", ")}): ${b.summary}`).join("\n")}`

const assets = () => `# Free assets

Find files yourself with web search/fetch or a browser; no API keys or extra tools. Use **direct file URLs** (the file itself, not its web page), then \`add_media_from_url\`, then use the mediaId. **Never put outside URLs in clips.**

## References: always Pinterest first

Before you design any look (captions, cards, b-roll, pacing), look for references on Pinterest, for every kind of video: reels, shorts, ads, long-form, explainers. They're to match a look, never to use as footage.
- Search: https://www.pinterest.com/search/pins/?q=reel%20short&rs=typed, changing the \`q=\` words to what you need, e.g. "reel captions", "talking head reel edit", "youtube video editing style", "product ad video".
- Open 2–3 strong pins and note what they do (caption size, place and colours, cut rhythm, how cards enter). Then compare your \`render_frames\` against them.
- Only if Pinterest has nothing useful, use other sources.
- If Pinterest asks you to sign in, use a browser where the user is already signed in, or ask the user to sign in there. Never ask for or keep a password.
- ${REEL_REFERENCES[0]}

## Files
- **B-roll video & photos:** Pexels (free, no attribution needed), Pixabay (free; hotlinking isn't allowed, so always bring files in). Prefer **≤ 720p** video (smaller, faster).
- **Sound effects & music:** Pixabay sound effects / music.
- **Logos:** https://api.svgl.app (SVG; JSON list with file URLs). Add with \`add_media_from_url\`, or draw inline with \`M.svg(markup)\` in a code clip. Use a brand's logo only to show that brand.
- **Avatars (placeholders):** https://i.pravatar.cc/256`

const recipes = () => `# Recipes

- **Modern captions for Reels, TikTok and Shorts:** \`add_captions\` with \`look: "lead-in"\` (a faint lead-in line over one big key word on a red box), \`"accent"\` (white words, the key word purple with a line drawing on under it) or \`"heavy-fill"\` (huge heavy words in a soft pink wash, a rare shock word in red). One key word per phrase. Briefs: \`brief:lead-in-reel\`, \`brief:accent-reel\`, \`brief:heavy-fill-reel\`.
- **Kinetic captions:** Kinetic Caption element, 1–4 words, \`*word*\` for one emphasis word, \`times\` from the transcript's word timings. Never shorter than 0.6 s.
- **Pop-in callouts / stickers:** Badge Pop / Highlight Box / Arrow Pointer, 1.5–3 s, entering on the word that mentions them.
- **Lower thirds:** Bar Lower Third / Pill Name Tag in the first 10 s, 3–5 s, name + role.
- **Pacing:** something changes every 2–4 s in short videos (cut, caption, b-roll, zoom), every 5–10 s in long ones.
- **Safe zones:** 9:16: text between 18% and 75% down, 6% side margins. 16:9: 5% margins, captions above the bottom 10%.
- **SFX on hits:** a short whoosh/pop (≤ 0.5 s, volume 0.15–0.3) on the bottom track, starting on the cut or pop-in it accents. Never over important speech.
- **B-roll:** volume 0 under speech; full screen, or a rounded card (radius 32–48) on a Solid Colour backdrop.`

/** The guide (or one topic of it) as Markdown. */
export function guide(topic: string, tools: string[]): string | null {
  if (topic.startsWith("brief:")) return findBrief(topic.slice("brief:".length))?.body ?? null
  switch (topic) {
    case "overview":
      return overview(tools)
    case "project":
      return project()
    case "workflow":
      return workflow()
    case "code-clips":
      return codeClips()
    case "elements":
      return elements()
    case "briefs":
      return briefs()
    case "assets":
      return assets()
    case "recipes":
      return recipes()
    default:
      return null
  }
}
