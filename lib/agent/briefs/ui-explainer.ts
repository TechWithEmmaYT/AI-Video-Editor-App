import { talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Explainer reel with no stock footage at all: every cutaway is a card built from what's being
 * said, on a dark backdrop with one accent colour. Captions stay small and quiet so the graphics
 * carry the screen.
 */
export const uiExplainer = talkingHeadBrief({
  id: "ui-explainer",
  name: "UI explainer",
  summary: "Vertical explainer (9:16) built entirely from motion graphics: checklists, stats and quote cards on a dark backdrop, with quiet accumulating captions.",
  format: "9:16",
  useFor: "an explainer or teaching reel (9:16) about something abstract — a process, a framework, numbers. No stock footage: every cutaway is built from the words.",
  caption: {
    words: "2–4 words",
    emphasis: "one word per phrase, in the accent colour only — no second font, no italics",
    placement: "move the box to the lower middle: x 8% of the width, width 84%, y ≈ 60% down, height 16%",
    scale: 0.65,
    mode: "words",
    look: '`font: "Inter"`, `weight: 600`, `color: "#ffffff"`, `pastOpacity: 0.45`, `emphasisFont: "Inter"`, `emphasisWeight: 700`, `emphasisColor: "#a78bfa"`, `emphasisItalic: false`, `emphasisScale: 1`, `highlight: "none"`, `animation: "fade"`, `shadow: true`',
  },
  broll: {
    every: "4–6 s",
    length: "3–5 s",
    maxShare: "half",
    card: "box ≈ 62% of the width and 46% of the height, centred, `radius: 40`",
    kinds: ["graphic"],
  },
  hook: "for the first 3 s (the hook) and the last 3 s",
  safeZone: "text between 20% and 80% down, 8% side margins",
  music: "a steady bed, volume ≤ 0.2",
  extras: [
    "**Dark backdrop.** Under every card, put a **Dot Grid** on the backdrop track (dark base #141019, dots in the accent at low opacity) for the same frames. Never let a card sit on bare black.",
    "**Cut in with the shape.** Start each cutaway with a **Shape Grow** on the track above the speaker for 20–24 frames (`color` = the accent, `shapeColor` = the card's background). The card's own clip starts as the Shape Grow ends, with `animateIn: \"grow\"`.",
    "**One accent.** Pick a single accent colour in step 1 and use it for every caption emphasis, every card accent and every transition. The backdrop, the cards and the type never introduce a second hue.",
  ],
  extraElements: ["dot-grid", "shape-grow"],
})
