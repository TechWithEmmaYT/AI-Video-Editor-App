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
  }
  broll: {
    every: string
    length: string
    /** At most this share of the video is b-roll. */
    maxShare: string
    card: string
  }
  /** Speaker on screen at the start and the end. */
  hook: string
  safeZone: string
  music: string
  /** Extra steps for this style (after b-roll, before checks). */
  extras: string[]
  /** Extra built-in elements the extras use. */
  extraElements: string[]
}

const SHARED_TOOLS = ["get_project", "get_media", "get_media_transcript", "add_media_from_url", "add_clip", "update_clip"]

export function talkingHeadBrief(style: TalkingHeadStyle): Brief {
  const { caption, broll } = style
  const extras = style.extras.map((step, i) => `${6 + i}. ${step}`).join("\n")
  const checkStep = 6 + style.extras.length

  return {
    id: style.id,
    name: style.name,
    summary: style.summary,
    formats: [style.format],
    elements: ["kinetic-caption", "solid-colour", ...style.extraElements],
    tools: SHARED_TOOLS,
    body: `# ${style.name}

**Use for:** ${style.useFor}

## Tracks (top to bottom)

1. **Captions**: one Kinetic Caption clip per phrase.
2. **B-roll**: video or image clips, **volume 0** so the speaker's voice keeps playing.
3. **Backdrop**: Solid Colour (black), only under b-roll shown as a card.
4. **Speaker**: the talking-head video, full screen, with its own audio, from start to end.
5. Music/SFX at the very bottom, optional (${style.music}).

## Steps

1. Call \`get_project\`. The speaker is the long video clip with speech. Call \`get_media\` on it to see it (contact sheet).
2. Call \`get_media_transcript\` on the speaker's mediaId. Word timings come with ImageKit transcripts. Without them, spread the words evenly. Source time → timeline frame: \`clip.from + round(sourceSeconds × fps) − clip.trimStartFrames\`.
3. **Captions.** Split the speech into phrases of **${caption.words}**, at natural pauses, never across sentences.
   - **Emphasis:** ${caption.emphasis}. Write it as \`*word*\` in \`text\`, e.g. \`"this changes *everything*"\`.
   - Add a **Kinetic Caption** per phrase on the captions track. Set \`from\` to the frame of the phrase's first word. It lasts until the next phrase starts, or until the last word ends + 0.3 s at a pause. Never shorter than 0.6 s.
   - Set \`times\` to each word's start in seconds **from the caption's start**, 2 decimals: \`"0, 0.28, 0.61"\`.
   - Set \`scale: ${caption.scale}\`. **Placement:** ${caption.placement}. Captions on one track must not overlap.
4. **B-roll.** Every **${broll.every}** of speech, find a moment where the words name something visual (a place, object or action).
   - Find a matching free clip (see \`get_guide({ topic: "assets" })\`: Pexels/Pixabay, ≤720p, direct file URL). Bring it in with \`add_media_from_url\`. Never put an outside URL in a clip.
   - Place it on the b-roll track starting **on the phrase that names it**, for **${broll.length}**, with \`volume: 0\`.
   - **Full screen:** box = the whole canvas, \`fit: "cover"\`.
   - **Card on black:** ${broll.card}, \`fit: "cover"\`. Add a Solid Colour (#000) on the backdrop track for the same frames.
   - Mix both styles. Never two cards in a row longer than 6 s.
5. **Cut back to the speaker** between b-roll: show the speaker for at least 2 s between b-roll clips, ${style.hook}. B-roll covers at most ${broll.maxShare} of the video.
${extras ? `${extras}\n` : ""}${checkStep}. **Check:** call \`get_project\` again. Make sure there are no gaps on the speaker track, no overlaps on the captions track, every b-roll clip has volume 0, and every caption's \`times\` has one number per word.

## Numbers

| | |
|---|---|
| Caption | ${caption.words}, ≥ 0.6 s; emphasis: ${caption.emphasis} |
| Caption look | Inter 900 white + Playfair Display Italic 700 red (#ff3b30), pop-in, shadow on, scale ${caption.scale} |
| B-roll | every ${broll.every}, ${broll.length} each, volume 0, at most ${broll.maxShare} of the video |
| Card | ${broll.card}, on black |
| Safe zone (${style.format}) | ${style.safeZone} |
`,
  }
}
