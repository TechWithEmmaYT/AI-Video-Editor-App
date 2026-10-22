import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * The default reel: Montserrat ExtraBold captions, lowercase and tight, in the caption safe zone,
 * with the key word in a warm accent and a rare punch word in a second one.
 */
export const crispReel = talkingHeadBrief({
  id: "crisp-reel",
  name: "Modern · Crisp reel",
  summary:
    "The default for Reels/TikTok/Shorts talking heads: lowercase Montserrat ExtraBold captions popping in word by word below the face, the key word in a warm accent, a rare punch word in a second accent, soft shadow, no box.",
  format: "9:16",
  useFor: "any talking-head Reel, TikTok or Short (9:16) unless the user or the reference asks for another look.",
  caption: {
    words: "1–4 words",
    emphasis:
      "exactly one key word per phrase — the noun, verb or number the phrase turns on — in the primary accent. Mark only the 5–8 payoff words of the whole video as the punch word instead, with `~word~` (the second accent); if more than about a quarter of the captions have one, it stops reading as a punch",
    placement: "the caption safe zone: x 64, y 1020, width 952, height 400 on 1080×1920 (between 53% and 74% down), clear of the face and of the app's buttons",
    scale: 0.42,
    mode: "replace",
    look:
      "the Modern · Crisp element's defaults are the look (Montserrat 800, all lowercase, `tracking: -0.01`, white words, a soft shadow, no box, words popping in). Its colours are only an example: pick `emphasisColor` (the key word) and `accentColor` (the punch word) from the video and your reference, two accents and never more, both readable on the footage. Leave `emphasisFit` on: a long key word grows less, so it never runs past the safe zone",
    element: { id: "crisp-caption", name: "Modern · Crisp", look: "crisp" },
  },
  broll: {
    every: "3–5 s",
    length: "1.5–3 s",
    maxShare: "half",
    card: "box ≈ 86% of the width and 46% of the height, centred, with the captions on top of it, `radius: 40`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 2 s (the hook) and the last 2 s",
  safeZone: "captions between 53% and 74% down, 6% side margins; anything else between 18% and 75% down",
  music: "quiet, volume ≤ 0.2",
  extras: [],
  extraElements: [],
  references: REEL_REFERENCES,
})
