/*
 * The sound effects library, the same as Mockshot's: effects made with Web Audio (rendered once
 * to WAV, in public/sfx/made) and recorded samples (public/sfx/samples). Files ship with the app,
 * so nothing is downloaded from outside; the agent adds one with add_sound_effect.
 */

export type SoundEffectGroup = "Transitions" | "Interface" | "Hits" | "Samples"

export type SoundEffect = {
  id: string
  name: string
  group: SoundEffectGroup
  /** Seconds. */
  length: number
  /** Under public/sfx/. */
  file: string
}

export const SOUND_EFFECTS: SoundEffect[] = [
  { id: "airy-woosh", name: "Airy woosh", group: "Transitions", length: 1.3, file: "made/airy-woosh.wav" },
  { id: "soft-woosh", name: "Soft woosh", group: "Transitions", length: 0.9, file: "made/soft-woosh.wav" },
  { id: "long-woosh", name: "Long woosh", group: "Transitions", length: 1.8, file: "made/long-woosh.wav" },
  { id: "cold-woosh", name: "Cold woosh", group: "Transitions", length: 1.5, file: "made/cold-woosh.wav" },
  { id: "whoosh", name: "Whoosh", group: "Transitions", length: 0.7, file: "made/whoosh.wav" },
  { id: "swoosh-down", name: "Swoosh down", group: "Transitions", length: 0.6, file: "made/swoosh-down.wav" },
  { id: "fast-whoosh", name: "Fast whoosh", group: "Transitions", length: 0.35, file: "made/fast-whoosh.wav" },
  { id: "riser", name: "Riser", group: "Transitions", length: 2.2, file: "made/riser.wav" },
  { id: "charge-beam", name: "Charge beam", group: "Transitions", length: 0.55, file: "made/charge-beam.wav" },
  { id: "modern-click", name: "Modern click", group: "Interface", length: 0.08, file: "made/modern-click.wav" },
  { id: "ui-click", name: "UI click", group: "Interface", length: 0.06, file: "made/ui-click.wav" },
  { id: "ui-click-2", name: "UI click 2", group: "Interface", length: 0.15, file: "made/ui-click-2.wav" },
  { id: "button-press", name: "Button press", group: "Interface", length: 0.16, file: "made/button-press.wav" },
  { id: "click", name: "Click", group: "Interface", length: 0.08, file: "made/click.wav" },
  { id: "pop", name: "Pop", group: "Interface", length: 0.15, file: "made/pop.wav" },
  { id: "confirm-bubble", name: "Confirm bubble", group: "Interface", length: 0.35, file: "made/confirm-bubble.wav" },
  { id: "typing", name: "Typing", group: "Interface", length: 1.6, file: "made/typing.wav" },
  { id: "notification", name: "Notification", group: "Interface", length: 0.6, file: "made/notification.wav" },
  { id: "success", name: "Success", group: "Interface", length: 0.8, file: "made/success.wav" },
  { id: "shutter", name: "Camera shutter", group: "Interface", length: 0.3, file: "made/shutter.wav" },
  { id: "granular-ripple", name: "Granular ripple", group: "Hits", length: 1.45, file: "made/granular-ripple.wav" },
  { id: "impact", name: "Impact", group: "Hits", length: 1.2, file: "made/impact.wav" },
  { id: "ding", name: "Ding", group: "Hits", length: 1.4, file: "made/ding.wav" },
  { id: "bass-drop", name: "Bass drop", group: "Hits", length: 1.5, file: "made/bass-drop.wav" },
  { id: "reveal-chime", name: "Reveal chime", group: "Hits", length: 1.8, file: "made/reveal-chime.wav" },
  { id: "unlock", name: "Unlock", group: "Interface", length: 0.9, file: "made/unlock.wav" },
  { id: "sparkle", name: "Sparkle", group: "Hits", length: 1.4, file: "made/sparkle.wav" },
  { id: "coin", name: "Coin", group: "Interface", length: 0.7, file: "made/coin.wav" },
  { id: "soft-tap", name: "Soft tap", group: "Interface", length: 0.2, file: "made/soft-tap.wav" },
  { id: "felt-key", name: "Felt key", group: "Interface", length: 0.18, file: "made/felt-key.wav" },
  { id: "toggle", name: "Toggle", group: "Interface", length: 0.2, file: "made/toggle.wav" },
  { id: "level-up", name: "Level up", group: "Hits", length: 1.1, file: "made/level-up.wav" },
  { id: "error-buzz", name: "Error buzz", group: "Interface", length: 0.4, file: "made/error-buzz.wav" },
  { id: "whip", name: "Whip", group: "Transitions", length: 0.45, file: "made/whip.wav" },
  { id: "swipe-up", name: "Swipe up", group: "Transitions", length: 0.5, file: "made/swipe-up.wav" },
  { id: "pass-by", name: "Pass by", group: "Transitions", length: 1.1, file: "made/pass-by.wav" },
  { id: "deep-hit", name: "Deep hit", group: "Hits", length: 1.6, file: "made/deep-hit.wav" },
  { id: "drop-in", name: "Drop in", group: "Hits", length: 0.5, file: "made/drop-in.wav" },
  { id: "warm-swell", name: "Warm swell", group: "Transitions", length: 2, file: "made/warm-swell.wav" },
  { id: "glass-tap", name: "Glass tap", group: "Interface", length: 0.8, file: "made/glass-tap.wav" },
  { id: "blip", name: "Blip", group: "Interface", length: 0.16, file: "made/blip.wav" },
  { id: "dot-pops", name: "Dot pops", group: "Interface", length: 0.9, file: "made/dot-pops.wav" },
  { id: "counter-roll", name: "Counter roll", group: "Interface", length: 1.2, file: "made/counter-roll.wav" },
  { id: "slam", name: "Slam", group: "Hits", length: 1.3, file: "made/slam.wav" },
  { id: "sample-air-woosh", name: "Air woosh", group: "Samples", length: 0.81, file: "samples/air-woosh.wav" },
  { id: "sample-button-press-ui", name: "Button press UI", group: "Samples", length: 0.31, file: "samples/button-press-ui.wav" },
  { id: "sample-click", name: "Click", group: "Samples", length: 0.91, file: "samples/click.wav" },
  { id: "sample-fast-whoosh", name: "Fast whoosh", group: "Samples", length: 1.2, file: "samples/fast-whoosh.mp3" },
  { id: "sample-granular-ripple", name: "Granular ripple", group: "Samples", length: 1, file: "samples/granular-ripple.wav" },
  { id: "sample-keyboard", name: "Keyboard", group: "Samples", length: 8.73, file: "samples/keyboard.wav" },
  { id: "sample-long-woosh", name: "Long woosh", group: "Samples", length: 0.63, file: "samples/long-woosh.wav" },
  { id: "sample-modern-click", name: "Modern click", group: "Samples", length: 0.16, file: "samples/modern-click.wav" },
  { id: "sample-paper-crumble", name: "Paper crumble", group: "Samples", length: 2.25, file: "samples/paper-crumble.wav" },
  { id: "sample-paper-flip-high-pitch", name: "Paper flip high pitch", group: "Samples", length: 0.86, file: "samples/paper-flip-high-pitch.wav" },
  { id: "sample-paper-flip", name: "Paper flip", group: "Samples", length: 0.93, file: "samples/paper-flip.mp3" },
  { id: "sample-riser-metallic", name: "Riser metallic", group: "Samples", length: 5.2, file: "samples/riser-metallic.wav" },
  { id: "sample-zoom-sound", name: "Zoom sound", group: "Samples", length: 2.81, file: "samples/zoom-sound.wav" },
]

export const findSoundEffect = (id: string) => SOUND_EFFECTS.find((effect) => effect.id === id) ?? null
