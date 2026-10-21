import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Modern reel: mid-screen captions in two tiers, the lesser words small and faint above the one
 * that matters, which lands big on a red box. Each word fades up out of a blur.
 */
export const leadInReel = talkingHeadBrief({
  id: "lead-in-reel",
  name: "Modern · Lead-in reel",
  summary: "Reels/TikTok/Shorts talking head with mid-screen captions in two tiers: a faint lead-in line over one big key word on a red box, words fading up out of a blur.",
  format: "9:16",
  useFor: "a talking-head Reel, TikTok or Short (9:16) when the user wants modern captions: every phrase builds word by word mid-screen, and its key word is what you read.",
  caption: {
    words: "2–4 words",
    emphasis:
      "exactly one key word per phrase — the noun, verb or number the phrase turns on. It is set big on the red box; the other words sit small and faint above it. Now and then (once every 4–6 phrases) mark a short warm word like `~you~` or `~love~` with tildes instead: it is set big in an italic serif, with no box",
    placement: "mid-screen: x 6% of the width, width 88%, y 36% down, height 24%",
    scale: 1,
    mode: "replace",
    look: "the Modern · Lead-in element's own defaults already are the look (`arrange: \"lead-in\"`, `leadScale: 0.4`, `leadOpacity: 0.7`, Inter Tight 800/900, `highlight: \"box\"`, `highlightColor: \"#e11d2e\"`, `highlightHold: true`, `accentFont: \"Instrument Serif\"`, `animation: \"blur-rise\"`); set nothing else",
    element: { id: "lead-in-caption", name: "Modern · Lead-in", look: "lead-in" },
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
