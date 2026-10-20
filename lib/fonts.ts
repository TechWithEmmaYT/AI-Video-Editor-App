/*
 * The curated fonts text clips can use (Google Fonts via @remotion/google-fonts). Each one is
 * imported on demand, so a project only downloads the fonts it uses. Shared by the editor UI
 * and the Remotion composition, so the preview and the export load the same files.
 */

type FontModule = {
  // Method syntax: each font's own loadFont narrows `weights` to what it ships.
  loadFont(
    style?: "normal",
    options?: { weights?: string[]; subsets?: string[]; ignoreTooManyRequestsWarning?: boolean }
  ): { waitUntilDone: () => Promise<unknown> }
}

export type FontCategory = "Sans" | "Display" | "Serif" | "Mono" | "Handwritten"

export type FontDef = {
  family: string
  category: FontCategory
  /** Weights the font ships; the weight picker offers only these. */
  weights: number[]
  load: () => Promise<FontModule>
}

const ALL = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export const FONTS: FontDef[] = [
  { family: "Inter", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Inter") },
  { family: "Inter Tight", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/InterTight") },
  { family: "DM Sans", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/DMSans") },
  { family: "Poppins", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Poppins") },
  { family: "Montserrat", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Montserrat") },
  { family: "Outfit", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Outfit") },
  { family: "Manrope", category: "Sans", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/Manrope") },
  { family: "Plus Jakarta Sans", category: "Sans", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/PlusJakartaSans") },
  { family: "Sora", category: "Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/Sora") },
  { family: "Space Grotesk", category: "Sans", weights: [300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/SpaceGrotesk") },
  { family: "Bricolage Grotesque", category: "Display", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/BricolageGrotesque") },
  { family: "Fredoka", category: "Display", weights: [300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/Fredoka") },
  { family: "Bebas Neue", category: "Display", weights: [400], load: () => import("@remotion/google-fonts/BebasNeue") },
  { family: "Anton", category: "Display", weights: [400], load: () => import("@remotion/google-fonts/Anton") },
  { family: "Oswald", category: "Display", weights: [200, 300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/Oswald") },
  { family: "Playfair Display", category: "Serif", weights: [400, 500, 600, 700, 800, 900], load: () => import("@remotion/google-fonts/PlayfairDisplay") },
  { family: "DM Serif Display", category: "Serif", weights: [400], load: () => import("@remotion/google-fonts/DMSerifDisplay") },
  { family: "Instrument Serif", category: "Serif", weights: [400], load: () => import("@remotion/google-fonts/InstrumentSerif") },
  { family: "JetBrains Mono", category: "Mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/JetBrainsMono") },
  { family: "Caveat", category: "Handwritten", weights: [400, 500, 600, 700], load: () => import("@remotion/google-fonts/Caveat") },
]

export const DEFAULT_FONT = "Inter"

export function findFont(family: string) {
  return FONTS.find((font) => font.family === family)
}

/** The closest weight the font actually ships (e.g. 800 → 400 for Bebas Neue). */
export function nearestWeight(font: FontDef, weight: number) {
  return font.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), font.weights[0])
}

/** CSS font-family with a fallback, for anywhere a text clip is drawn. */
export function fontStack(family: string) {
  const font = findFont(family)
  const fallback = font?.category === "Serif" ? "serif" : font?.category === "Mono" ? "monospace" : "sans-serif"
  return `"${family}", ${fallback}`
}

const loading = new Map<string, Promise<void>>()

/**
 * Loads one weight of a curated font (Latin only) into the page. Cached, never rejects:
 * if it fails the text falls back to the stack's generic family.
 */
export function loadFont(family: string, weight: number): Promise<void> {
  const font = findFont(family)
  if (!font) return Promise.resolve()
  const actual = nearestWeight(font, weight)
  const key = `${family}:${actual}`
  let promise = loading.get(key)
  if (!promise) {
    promise = font
      .load()
      .then((module) =>
        module
          .loadFont("normal", { weights: [String(actual)], subsets: ["latin"], ignoreTooManyRequestsWarning: true })
          .waitUntilDone()
      )
      .then(() => undefined)
      .catch(() => undefined)
    loading.set(key, promise)
  }
  return promise
}

/** Every weight of a curated font (code clips choose weights in their own code). */
export function loadFontFamily(family: string): Promise<void> {
  const font = findFont(family)
  if (!font) return Promise.resolve()
  return Promise.all(font.weights.map((weight) => loadFont(family, weight))).then(() => undefined)
}
