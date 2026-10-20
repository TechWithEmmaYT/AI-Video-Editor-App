import type { Brief } from "@/lib/agent/briefs/types"

export const reelCaptions: Brief = {
  id: "reel-captions",
  name: "Reel captions + b-roll",
  summary: "Talking head for Reels/TikTok/Shorts: word-by-word captions with one emphasis word, b-roll every 3–5 s, cut back to the speaker.",
  formats: ["9:16"],
  elements: ["kinetic-caption", "solid-colour"],
  tools: ["get_project", "get_media", "get_media_transcript", "add_media_from_url", "add_clip", "update_clip"],
  body: `# Reel captions + b-roll

**Use for:** a talking-head video cut for Reels, TikTok or Shorts (9:16). Every phrase is captioned word by word, and b-roll shows what's being said.

## Tracks (top to bottom)

1. **Captions**: one Kinetic Caption clip per phrase.
2. **B-roll**: video or image clips, **volume 0** so the speaker's voice keeps playing.
3. **Backdrop**: Solid Colour (black), only under b-roll shown as a card.
4. **Speaker**: the talking-head video, full screen, with its own audio, from start to end.
5. Music/SFX at the very bottom, optional and quiet (volume ≤ 0.2).

## Steps

1. Call \`get_project\`. The speaker is the long video clip with speech. Call \`get_media\` on it to see it (contact sheet).
2. Call \`get_media_transcript\` on the speaker's mediaId. Word timings come with ImageKit transcripts. Without them, spread the words evenly. Source time → timeline frame: \`clip.from + round(sourceSeconds × fps) − clip.trimStartFrames\`.
3. **Captions.** Split the speech into phrases of **1–4 words**, at natural pauses, never across sentences.
   - Pick **one emphasis word** per phrase (the key noun, verb or number) and write it as \`*word*\` in \`text\`, e.g. \`"this changes *everything*"\`.
   - Add a **Kinetic Caption** per phrase on the captions track. Set \`from\` to the frame of the phrase's first word. It lasts until the next phrase starts, or until the last word ends + 0.3 s at a pause. Never shorter than 0.6 s.
   - Set \`times\` to each word's start in seconds **from the caption's start**, 2 decimals: \`"0, 0.28, 0.61"\`.
   - Keep the caption's default box (top third: 18–33% down). Captions on one track must not overlap.
4. **B-roll.** Every **3–5 s** of speech, find a moment where the words name something visual (a place, object or action).
   - Find a matching free clip (see \`get_guide({ topic: "assets" })\`: Pexels/Pixabay, ≤720p, direct file URL). Bring it in with \`add_media_from_url\`. Never put an outside URL in a clip.
   - Place it on the b-roll track starting **on the phrase that names it**, for **1.5–3 s**, with \`volume: 0\`.
   - **Full screen:** box = the whole canvas, \`fit: "cover"\`.
   - **Card on black:** box ≈ 86% of the width, centred, top at ≈ 38% down (under the captions), \`fit: "cover"\`, \`radius: 40\`. Add a Solid Colour (#000) on the backdrop track for the same frames.
   - Mix both styles. Never two cards in a row longer than 6 s.
5. **Cut back to the speaker** between b-roll: show the speaker for at least 2 s between b-roll clips, for the first 2 s (the hook) and the last 2 s. B-roll covers at most half of the video.
6. **Check:** call \`get_project\` again. Make sure there are no gaps on the speaker track, no overlaps on the captions track, every b-roll clip has volume 0, and every caption's \`times\` has one number per word.

## Numbers

| | |
|---|---|
| Caption | 1–4 words, ≥ 0.6 s, one *emphasis* word |
| Caption look | Inter 900 white + Playfair Display Italic 700 red (#ff3b30), pop-in, shadow on |
| B-roll | every 3–5 s, 1.5–3 s each, volume 0 |
| Card | 86% width, radius 40, on black |
| Safe zone (9:16) | text between 18% and 75% down, 6% side margins |
`,
}
