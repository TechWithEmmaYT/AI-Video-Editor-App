import { talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * Long horizontal talking head (YouTube): the same captions and b-roll as the reel, calmer:
 * longer captions in the bottom band, b-roll less often, plus chapters, a name and title cards.
 */
export const longForm = talkingHeadBrief({
  id: "long-form",
  name: "Long-form captions + b-roll",
  summary: "Talking head for YouTube (16:9): calmer captions in the bottom band, b-roll every 8–15 s, chapters as sections, a name lower third.",
  format: "16:9",
  useFor: "a longer talking-head video for YouTube (16:9): tutorials, explainers, vlogs. Same captions and b-roll as the reel, at a calmer pace.",
  caption: {
    words: "3–7 words (one line)",
    emphasis: "at most one emphasis word per sentence, and only for key words (not every caption needs one)",
    placement:
      "move the box to the bottom band: x 10% of the width, width 80%, y ≈ 74% down, height 14% (above the player controls)",
    scale: 0.8,
    mode: "replace",
    look: '`font: "Inter"`, `weight: 700`, `color: "#ffffff"`, `emphasisColor: "#ffd166"`, `emphasisItalic: false`, `highlight: "none"`, `animation: "fade"`, `shadow: true`',
  },
  broll: {
    every: "8–15 s",
    length: "3–6 s",
    maxShare: "a third",
    card: "box ≈ 70% of the width, centred both ways, `radius: 32`",
    kinds: ["stock", "graphic"],
  },
  hook: "for the first 5 s (the speaker introduces the video) and the last 5 s",
  safeZone: "5% margins on every side; captions above the bottom 10%",
  music: "very quiet under speech, volume ≤ 0.12",
  extras: [
    "**Chapters.** If the transcript has chapters, add a section for each (named after the chapter, from its start to the next one's). At each chapter start, add a **Big Title** with the chapter's name for 2 s, on the captions track.",
    "**Name.** In the first 10 s, add a **Bar Lower Third** with the speaker's name and role (ask the user if you don't know them), for 4 s.",
  ],
  extraElements: ["big-title", "bar-lower-third"],
})
