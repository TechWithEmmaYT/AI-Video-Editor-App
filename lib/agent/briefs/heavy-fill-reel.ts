import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Modern reel: huge, heavy, tightly set words filling the width mid-screen, in a soft see-through
 * pink wash over the footage. A rare shock word lands in solid red.
 */
export const heavyFillReel = talkingHeadBrief({
  id: "heavy-fill-reel",
  name: "Modern · Heavy fill reel",
  summary: "Reels/TikTok/Shorts talking head with huge heavy captions filling the width in a soft pink wash, and a shock word in solid red now and then.",
  format: "9:16",
  useFor: "a bold, poster-like talking-head Reel, TikTok or Short (9:16): one or two huge words at a time, the type almost a texture over the speaker.",
  caption: {
    words: "1–2 words",
    emphasis:
      "a shock word, sparingly: caption with `emphasis: false`, then wrap one word in `*word*` (with `update_clip` on its `text`) in only 2–4 phrases of the video, the ones you'd shout. It lands in solid red; every other word keeps the pink wash",
    placement: "mid-screen: x 6% of the width, width 88%, y 33% down, height 30% — the words grow to fill the width",
    scale: 1,
    mode: "replace",
    look: "the Modern · Heavy fill element's own defaults already are the look (Inter Tight 900, `tracking: -0.06`, `fitWidth: true`, `fill: \"texture\"` from `#f2c9cf` to `#c48b96` at `fillOpacity: 0.85`, `emphasisColor: \"#e11d2e\"`, `animation: \"blur-rise\"`, `shadow: false`); set nothing else",
    element: { id: "heavy-caption", name: "Modern · Heavy fill", look: "heavy-fill" },
  },
  broll: {
    every: "4–6 s",
    length: "1.5–3 s",
    maxShare: "a third",
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
