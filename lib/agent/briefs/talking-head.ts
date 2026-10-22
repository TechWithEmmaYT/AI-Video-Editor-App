import type { Brief } from "@/lib/agent/briefs/types"
import type { ProjectFormat } from "@/types/project"

/*
 * The talking-head styles share one set of rules (tracks, transcript timing, captions, b-roll,
 * cutting back to the speaker, checks). Each style only sets its numbers and extras.
 */

export type TalkingHeadStyle = {
  id: string
  name: string
  summary: string
  format: ProjectFormat
  useFor: string
  caption: {
    words: string
    emphasis: string
    /** Where the caption box goes, said in words with exact numbers. */
    placement: string
    /** The Kinetic Caption `scale` param. */
    scale: number
    /** The look itself, written as the Kinetic Caption params to set. This is what makes a style a style. */
    look: string
    /** The `mode` param: "replace" (one phrase at a time), "words" or "lines" (they build up). */
    mode: "replace" | "words" | "lines"
    /** A caption element other than the Kinetic Caption, and the add_captions `look` that lays it. */
    element?: { id: string; name: string; look: string }
  }
  broll: {
    every: string
    length: string
    /** At most this share of the video is b-roll. */
    maxShare: string
    card: string
    /** Which kinds of b-roll this style uses: footage, built cards, or both. */
    kinds: ("stock" | "graphic")[]
  }
  /** Speaker on screen at the start and the end. */
  hook: string
  safeZone: string
  music: string
  /** Extra steps for this style (after b-roll, before checks). */
  extras: string[]
  /** Extra built-in elements the extras use. */
  extraElements: string[]
  /** Where to find reference videos of this kind, one line each. */
  references?: string[]
}

/** Where to find reference reels and shorts to match, for the vertical briefs. */
export const REEL_REFERENCES = [
  "Pinterest is full of reel and short edits to match. An example of this kind: https://www.pinterest.com/pin/1073123417590337055/",
  'Search Pinterest for more: https://www.pinterest.com/search/pins/?q=reel%20short&rs=typed, changing the `q=` words to what you need, e.g. "reel captions" or "talking head reel edit".',
]

const SHARED_TOOLS = ["get_project", "get_media", "get_media_transcript", "add_captions", "add_media_from_url", "add_clip", "update_clip", "render_frames"]

/** The rule for picking footage or a built card, written out for whichever kinds a style allows. */
function brollKinds(kinds: TalkingHeadStyle["broll"]["kinds"]) {
  const stock = "     - A **concrete** thing — a place, an object, a person doing something → **stock footage**. It shows what the words name."
  const graphic =
    "     - An **abstract** thing — a number, a list, a process, a comparison, a claim → **a built card**. Footage of someone typing says nothing; a Checklist Card with the three real steps says everything."
  if (kinds.length === 1) return kinds[0] === "stock" ? stock : graphic
  return `${stock}\n${graphic}`
}

export function talkingHeadBrief(style: TalkingHeadStyle): Brief {
  const { caption, broll } = style
  const captionId = caption.element?.id ?? "kinetic-caption"
  const captionName = caption.element?.name ?? "Kinetic Caption"
  const captionTool = caption.element
    ? `   - **Fastest:** \`add_captions({ mediaId, look: "${caption.element.look}" })\` lays the whole track in this look, one key word marked per phrase. Then fix a phrase by hand with \`update_clip\` where the key word it picked isn't the one you'd say loudest.\n`
    : ""
  const references = style.references?.length ? `\n## References\n\n${style.references.map((line) => `- ${line}`).join("\n")}\n` : ""
  const extras = style.extras.map((step, i) => `${6 + i}. ${step}`).join("\n")
  const checkStep = 6 + style.extras.length

  return {
    id: style.id,
    name: style.name,
    summary: style.summary,
    formats: [style.format],
    elements: [captionId, "solid-colour", ...(style.broll.kinds.includes("graphic") ? ["checklist-card", "stat-card", "quote-card"] : []), ...style.extraElements],
    tools: SHARED_TOOLS,
    body: `# ${style.name}

**Use for:** ${style.useFor}

## Tracks (top to bottom)

1. **Captions**: one ${captionName} clip per phrase.
2. **B-roll**: video or image clips, **volume 0** so the speaker's voice keeps playing.
3. **Backdrop**: Solid Colour (black), only under b-roll shown as a card.
4. **Speaker**: the talking-head video, full screen, with its own audio, from start to end.
5. Music/SFX at the very bottom, optional (${style.music}).

## Steps

1. Call \`get_project\`. The speaker is the long video clip with speech. Call \`get_media\` on it to see it (contact sheet).
2. Call \`get_media_transcript\` on the speaker's mediaId. Word timings come with ImageKit transcripts. Without them, spread the words evenly. Source time → timeline frame: \`clip.from + round(sourceSeconds × fps) − clip.trimStartFrames\`.
3. **Captions.** Split the speech into phrases of **${caption.words}**, at natural pauses, never across sentences.
   - **Emphasis:** ${caption.emphasis}. Write it as \`*word*\` in \`text\`, e.g. \`"this changes *everything*"\`.
${captionTool}   - Add a **${captionName}** per phrase on the captions track. Set \`from\` to the frame of the phrase's first word. It lasts until the next phrase starts, or until the last word ends + 0.3 s at a pause. Never shorter than 0.6 s.
   - Set \`times\` to each word's start in seconds **from the caption's start**, 2 decimals: \`"0, 0.28, 0.61"\`.
   - Set \`scale: ${caption.scale}\` and \`mode: "${caption.mode}"\`. **Placement:** ${caption.placement}. Captions on one track must not overlap.
   - **The look is the style.** Set these on every caption, the same on all of them: ${caption.look}
4. **B-roll.** Every **${broll.every}** of speech, find a moment worth cutting away from the speaker. Each cutaway lasts **${broll.length}**, sits on the b-roll track, and starts **on the phrase it illustrates**.

   **Which kind?** Read what the phrase actually names:
${brollKinds(broll.kinds)}

   - **Footage** — find a matching free clip (see \`get_guide({ topic: "assets" })\`: Pexels/Pixabay, ≤720p, direct file URL). Bring it in with \`add_media_from_url\`. Never put an outside URL in a clip. Set \`volume: 0\` so the speaker keeps talking.
     - **Full screen:** box = the whole canvas, \`fit: "cover"\`.
     - **Card on black:** ${broll.card}, \`fit: "cover"\`. Add a Solid Colour (#000) on the backdrop track for the same frames.
   - **Built card** — add a **Checklist Card**, **Stat Card** or **Quote Card** with the real words from the speech. Put a background element (Gradient Mesh, Dot Grid or Solid Colour) on the backdrop track underneath for the same frames, and give the card \`${broll.card}\`.
   - Mix full-screen and card framings. Never two cards in a row longer than 6 s.
   - **Every cutaway enters.** Set \`animateIn\` on the clip: \`"pop"\` or \`"scale"\` for cards, \`"rise"\` for text, \`"grow"\` for a card arriving out of a transition. Use \`animateInFrames: 6–10\`. Nothing appears with a hard cut except a return to the speaker.
5. **Cut back to the speaker** between b-roll: show the speaker for at least 2 s between b-roll clips, ${style.hook}. B-roll covers at most ${broll.maxShare} of the video.
${extras ? `${extras}\n` : ""}${checkStep}. **Check the doc:** call \`get_project\` again. Make sure there are no gaps on the speaker track, no overlaps on the captions track, every b-roll clip has volume 0, and every caption's \`times\` has one number per word.
${checkStep + 1}. **Look, fix, repeat:** call \`render_frames\` (\`count: 12\` over the whole video) and look at every frame against your reference: captions readable, in the safe zone, not over the face; b-roll filling its box; nothing black. Fix what's wrong, render the same times again, and repeat until a round finds nothing (at most 5 rounds).

## Numbers

| | |
|---|---|
| Caption | ${caption.words}, ≥ 0.6 s; emphasis: ${caption.emphasis} |
| Caption look | ${caption.look}; mode ${caption.mode}, scale ${caption.scale} |
| B-roll | every ${broll.every}, ${broll.length} each, ${broll.kinds.join(" + ")}, footage at volume 0, at most ${broll.maxShare} of the video |
| Card | ${broll.card}, on black |
| Safe zone (${style.format}) | ${style.safeZone} |
${references}`,
  }
}
