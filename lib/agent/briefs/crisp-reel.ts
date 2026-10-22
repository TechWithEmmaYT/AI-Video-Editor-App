import { REEL_REFERENCES, talkingHeadBrief } from "@/lib/agent/briefs/talking-head"

/**
 * The default reel, written from a finished edit that worked: Montserrat Bold captions, lowercase,
 * in the caption safe zone, punch-in cuts on the speaker, b-roll that pops in, shutter cuts and
 * quiet, layered sound.
 */
export const crispReel = talkingHeadBrief({
  id: "crisp-reel",
  name: "Modern · Crisp reel",
  summary:
    "The default for Reels/TikTok/Shorts talking heads: lowercase Montserrat Bold captions popping in word by word below the face, a warm key word, rare lime punch words and a Playfair italic for the core idea; punch-in cuts on the speaker, popping b-roll, camera-shutter cuts and quiet layered sound.",
  format: "9:16",
  useFor: "any talking-head Reel, TikTok or Short (9:16) unless the user or the reference asks for another look.",
  caption: {
    words: "1–4 words",
    emphasis:
      "exactly one key word per phrase — the noun, verb or number the phrase turns on — in the warm accent (`*word*`). Mark only the 5–8 payoff words of the whole video as punch words instead, with `~word~` (lime). Mark the 3–4 words that carry the video's core idea with `_word_` (Playfair Display italic, lime, 1.35×), and no more, so it reads as deliberate",
    placement: "the caption safe zone: x 64, y 1020, width 952, height 400 on 1080×1920 (between 53% and 74% down), clear of the face and of the app's buttons",
    scale: 0.42,
    mode: "replace",
    look:
      "the Modern · Crisp element's defaults are the look (Montserrat 700, all lowercase even names, `tracking: -0.004`, white words, a soft shadow, no box, `animation: \"pop\"`). Three colour tiers and never more: white, the key-word accent, the punch/serif accent. The colours are only an example: pick `emphasisColor` and `accentColor` (and `serifColor`, usually the same as `accentColor`) from the video and your reference, both readable on the footage. Leave `emphasisFit` on: a key word grows 1.3× up to 7 letters, 1.15× at 8–9 and not at all from 10, so it never runs past the safe zone",
    element: { id: "crisp-caption", name: "Modern · Crisp", look: "crisp" },
  },
  broll: {
    every: "3–5 s",
    length: "1.5–3 s",
    maxShare: "30%",
    card: "a floating card: box x 76, y 260, width 928, height 760, `radius: 40` — in the upper half, so the captions at y 1020 are never covered",
    kinds: ["stock", "graphic"],
  },
  hook: "alone for the first ~9 s and the last ~6 s",
  safeZone: "captions between 53% and 74% down, 6% side margins; anything else between 18% and 75% down",
  music: "volume 0.045, fade in 2 s, fade out 3 s",
  extras: [
    `**Track order for this reel** (top draws over bottom), instead of the one above: shutter clips · captions that sit over full-screen b-roll · b-roll · every other caption · speaker · music · SFX · a second SFX track. A full-screen cutaway hides any caption on a track below it, so move the captions it overlaps to a track above it. A floating card needs no moving.`,
    `**B-roll for this reel.** Alternate the two framings: **full screen** (box x 0, y 0, 1080×1920, \`radius: 0\`, \`fit: "cover"\`) and **the floating card** above. Every cutaway has \`animateIn: "pop"\`, \`animateInFrames: 6–7\` and \`volume: 0\`. The floating card sits over the speaker, with no black backdrop under it. For a list, a count or a claim, use the **Dark List Card** (its real items, lowercase) on the floating card box with \`animateIn: "pop"\`; never a white card with light text.`,
    `**Punch-in cuts on the speaker.** Split the speaker clip at sentence boundaries (each part's trimStart carries on from the one before, so nothing is heard twice) and change its \`scale\` on each part; these are cuts, not moves. **The hook:** the first part starts already zooming, \`scale: 1.22\` with \`animateIn: "scale"\`, \`animateInFrames: 7\`, held through the first sentence; never start wide and cut in, or start tight and snap out. **Then** alternate tight and normal, one change every 3–6 s, between 1.0 and 1.16, e.g. 1.10 · 1.0 · 1.13 · 1.0 · 1.08 · 1.0 · **1.16** (the tightest on the single most important line) · 1.06. The speaker track stays continuous: no gaps, the audio never breaks.`,
    `**Shutter cuts.** Add a **Shutter Open** (0.45 s) at 0:00 on a new top track. On each full-screen cutaway's start and end, add a **Shutter Cut** (0.36 s) starting **0.18 s before the cut**, so the blades are shut exactly on it. Set its \`accent\` to the punch colour.`,
    `**Sound** (\`list_sound_effects\`, \`add_sound_effect\`; two sounds at one moment go on separate tracks on their own): the \`shutter\` at 0:00 (volume 0.5), on each full-screen cut (0.35) and on the tightest punch-in (0.32); a \`whoosh\` (volume 0.22) starting **0.15 s before** each cut it accents — the movement into the cut, the shutter is the arrival; a \`pop\` (0.32) exactly on each floating card's entrance, one per thing that appears. A full-screen cut = whoosh early + shutter on the cut; a card = whoosh early + pop on the entrance. A shutter recording with a burst of clicks is trimmed to one click: \`trimStart: 0, duration: 0.16\`. **Music** at volume 0.045 with \`fadeIn: 2\`, \`fadeOut: 3\` (update_clip): felt, not heard. Match it to the message: a serious, reflective script wants a sparse, sustained pad with no drums, not a beat.`,
  ],
  extraElements: ["shutter-open", "shutter-cut", "dark-list-card"],
  extraTools: ["list_sound_effects", "add_sound_effect", "split_clip"],
  references: REEL_REFERENCES,
})
