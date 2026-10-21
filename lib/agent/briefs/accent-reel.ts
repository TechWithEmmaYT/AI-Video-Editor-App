import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Modern reel: rounded white words mid-screen, the key word bolder and purple with a thin line
 * drawing on under it as it lands.
 */
export const accentReel = talkingHeadBrief({
  id: "accent-reel",
  name: "Modern · Accent colour reel",
  summary: "Reels/TikTok/Shorts talking head with clean rounded white captions mid-screen, one key word per phrase in purple with a line drawing on under it.",
  format: "9:16",
  useFor: "a friendly, clean talking-head Reel, TikTok or Short (9:16): white words build one at a time and the key word carries the colour.",
  caption: {
    words: "2–4 words",
    emphasis: "exactly one key word per phrase — the noun, verb or number the phrase turns on. It is drawn bolder in purple, with the line drawing on under it",
    placement: "mid-screen: x 6% of the width, width 88%, y 36% down, height 24%",
    scale: 1,
    mode: "replace",
    look: "the Modern · Accent colour element's own defaults already are the look (Poppins 600, white, `emphasisColor: \"#8b5cf6\"`, `emphasisWeight: 800`, `highlight: \"line\"`, `animation: \"blur-rise\"`); to match a brand, change `emphasisColor` and `highlightColor` together and nothing else",
    element: { id: "accent-caption", name: "Modern · Accent colour", look: "accent" },
  },
  broll: {
    every: "3–5 s",
    length: "1.5–3 s",
    maxShare: "half",
    card: "box ≈ 86% of the width and 46% of the height, centred, with the captions on top of it, `radius: 40`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 2 s (the hook) and the last 2 s",
  safeZone: "text between 18% and 75% down, 6% side margins (clear of the app's buttons)",
  music: "quiet, volume ≤ 0.2",
  extras: [],
  extraElements: [],
  references: REEL_REFERENCES,
})
