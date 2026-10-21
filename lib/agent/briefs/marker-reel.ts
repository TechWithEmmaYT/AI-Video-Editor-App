import { talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Bold reel: a red marker sweeps in behind each word as it's said, and the key words keep it.
 * Spoken words stay on screen and dim, so the phrase builds rather than flashing by. Cutaways are
 * mostly built cards on a near-white backdrop.
 */
export const markerReel = talkingHeadBrief({
  id: "marker-reel",
  name: "Marker reel",
  summary: "Vertical reel with a red marker sweeping in behind each spoken word, words building up, and white statement cards as cutaways.",
  format: "9:16",
  useFor: "a punchy vertical reel (9:16) where the captions carry the energy: a red marker lands on each word and holds on the key ones.",
  caption: {
    words: "2–4 words",
    emphasis: "one emphasis word per phrase — the one that keeps the marker, so make it the word you'd say loudest",
    placement: "keep the caption's default box (top third: 18–33% down)",
    scale: 1,
    mode: "words",
    look: '`font: "Inter"`, `weight: 900`, `color: "#ffffff"`, `pastOpacity: 0.55`, `emphasisFont: "Playfair Display"`, `emphasisColor: "#ff3b30"`, `emphasisItalic: true`, `highlight: "box"`, `highlightColor: "#ff3b30"`, `highlightHold: true`, `animation: "pop"`, `shadow: true`',
  },
  broll: {
    every: "4–6 s",
    length: "2–3 s",
    maxShare: "a third",
    card: "box ≈ 86% of the width, centred, top at ≈ 38% down (under the captions), `radius: 40`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 2 s (the hook) and the last 2 s",
  safeZone: "text between 18% and 75% down, 6% side margins (clear of the app's buttons)",
  music: "quiet, volume ≤ 0.2",
  extras: [
    "**Statement cards.** Two or three times, cut the speaker entirely and go full screen: a Solid Colour (#f4f2ef) on the backdrop track, a **Stat Card** or **Quote Card** over it with `bg: \"#f4f2ef\"` and `radius: 0`, and the caption carrying on over the top. `animateIn: \"grow\"`, 8 frames. Hold for 1.5–2.5 s, then cut back.",
  ],
  extraElements: [],
})
