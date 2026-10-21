import { talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/** Short vertical talking head: fast captions in the top third, b-roll every few seconds. */
export const reelCaptions = talkingHeadBrief({
  id: "reel-captions",
  name: "Reel captions + b-roll",
  summary: "Talking head for Reels/TikTok/Shorts: word-by-word captions with one emphasis word, b-roll every 3–5 s, cut back to the speaker.",
  format: "9:16",
  useFor: "a talking-head video cut for Reels, TikTok or Shorts (9:16). Every phrase is captioned word by word, and b-roll shows what's being said.",
  caption: {
    words: "1–4 words",
    emphasis: "one emphasis word per phrase (the key noun, verb or number)",
    placement: "keep the caption's default box (top third: 18–33% down)",
    scale: 1,
    mode: "replace",
    look: '`font: "Inter"`, `weight: 900`, `color: "#ffffff"`, `emphasisFont: "Playfair Display"`, `emphasisColor: "#ff3b30"`, `emphasisItalic: true`, `highlight: "none"`, `animation: "pop"`, `shadow: true`',
  },
  broll: {
    every: "3–5 s",
    length: "1.5–3 s",
    maxShare: "half",
    card: "box ≈ 86% of the width, centred, top at ≈ 38% down (under the captions), `radius: 40`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 2 s (the hook) and the last 2 s",
  safeZone: "text between 18% and 75% down, 6% side margins (clear of the app's buttons)",
  music: "quiet, volume ≤ 0.2",
  extras: [],
  extraElements: [],
})
