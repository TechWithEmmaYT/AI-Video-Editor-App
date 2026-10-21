import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Editorial reel: big soft-coloured type stacking a line at a time across the lower half, over a
 * calm sit-down shot. B-roll is colour-graded footage in a rounded card with a wide margin.
 */
export const stackedReel = talkingHeadBrief({
  id: "stacked-reel",
  name: "Stacked reel",
  summary: "Vertical reel with heavy type stacking line by line over the speaker, in one soft brand colour, and colour-graded b-roll in rounded cards.",
  format: "9:16",
  useFor: "a calm, designed vertical reel (9:16) for a brand or agency: the type is the design, stacking up over a steady sit-down shot.",
  caption: {
    words: "2–3 words per line, 2–3 lines per phrase",
    emphasis: "the payoff word of the phrase — give it `emphasisScale: 1.6` so it towers over the line above",
    placement: "move the box low and wide: x 4% of the width, width 92%, y ≈ 52% down, height 34% — the stack grows down across the speaker's body",
    scale: 1.15,
    mode: "lines",
    look: '`font: "Poppins"`, `weight: 800`, `color: "#e8b4a8"`, `pastOpacity: 1`, `emphasisFont: "Poppins"`, `emphasisWeight: 800`, `emphasisColor: "#e8b4a8"`, `emphasisItalic: false`, `emphasisScale: 1.6`, `highlight: "none"`, `animation: "pop"`, `shadow: false`',
  },
  broll: {
    every: "5–7 s",
    length: "2.5–4 s",
    maxShare: "a third",
    card: "box ≈ 88% of the width and 72% of the height, centred, `radius: 56`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 2 s (the hook) and the last 3 s",
  safeZone: "text between 50% and 88% down, 4% side margins",
  music: "quiet and steady, volume ≤ 0.18",
  extras: [
    "**Paper backdrop.** Behind every card cutaway, put a **Gradient Mesh** on the backdrop track with two near-white colours (#f6f4f1 → #ebe7e2), so the card reads as sitting on paper rather than on black.",
    "**One colour only.** Every caption and every card accent uses the same brand colour. Pick it in step 1 from the speaker's clothing or set, and never introduce a second.",
  ],
  extraElements: ["gradient-mesh"],
  references: REEL_REFERENCES,
})
