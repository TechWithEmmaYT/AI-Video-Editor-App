/*
 * The curated fonts text clips can use (Google Fonts via @remotion/google-fonts). Each one is
 * imported on demand, so a project only downloads the fonts it uses. Shared by the editor UI
 * and the Remotion composition, so the preview and the export load the same files.
 */

type FontModule = {
  // Method syntax: each font's own loadFont narrows `weights` to what it ships.
  loadFont(
    style?: FontStyle,
    options?: { weights?: string[]; subsets?: string[]; ignoreTooManyRequestsWarning?: boolean }
  ): { waitUntilDone: () => Promise<unknown> }
}

export type FontStyle = "normal" | "italic"

export type FontCategory = "Sans" | "Display" | "Serif" | "Mono" | "Handwritten"

export type FontDef = {
  family: string
  category: FontCategory
  /** Weights the font ships; the weight picker offers only these. */
  weights: number[]
  /** Weights it also ships in italic (none if it has no italics). */
  italics?: number[]
  load: () => Promise<FontModule>
}

const ALL = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export const FONTS: FontDef[] = [
  { family: "Inter", italics: ALL, category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Inter") },
  { family: "Inter Tight", italics: ALL, category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/InterTight") },
  { family: "DM Sans", italics: ALL, category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/DMSans") },
  { family: "Poppins", italics: ALL, category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Poppins") },
  { family: "Montserrat", italics: ALL, category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Montserrat") },
  { family: "Outfit", category: "Sans", weights: ALL, load: () => import("@remotion/google-fonts/Outfit") },
  { family: "Manrope", category: "Sans", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/Manrope") },
  { family: "Plus Jakarta Sans", italics: [200, 300, 400, 500, 600, 700, 800], category: "Sans", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/PlusJakartaSans") },
  { family: "Sora", category: "Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/Sora") },
  { family: "Space Grotesk", category: "Sans", weights: [300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/SpaceGrotesk") },
  { family: "Bricolage Grotesque", category: "Display", weights: [200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/BricolageGrotesque") },
  { family: "Fredoka", category: "Display", weights: [300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/Fredoka") },
  { family: "Bebas Neue", category: "Display", weights: [400], load: () => import("@remotion/google-fonts/BebasNeue") },
  { family: "Anton", category: "Display", weights: [400], load: () => import("@remotion/google-fonts/Anton") },
  { family: "Oswald", category: "Display", weights: [200, 300, 400, 500, 600, 700], load: () => import("@remotion/google-fonts/Oswald") },
  { family: "Playfair Display", italics: [400, 500, 600, 700, 800, 900], category: "Serif", weights: [400, 500, 600, 700, 800, 900], load: () => import("@remotion/google-fonts/PlayfairDisplay") },
  { family: "DM Serif Display", italics: [400], category: "Serif", weights: [400], load: () => import("@remotion/google-fonts/DMSerifDisplay") },
  { family: "Instrument Serif", italics: [400], category: "Serif", weights: [400], load: () => import("@remotion/google-fonts/InstrumentSerif") },
  { family: "JetBrains Mono", italics: [100, 200, 300, 400, 500, 600, 700, 800], category: "Mono", weights: [100, 200, 300, 400, 500, 600, 700, 800], load: () => import("@remotion/google-fonts/JetBrainsMono") },
  { family: "Caveat", category: "Handwritten", weights: [400, 500, 600, 700], load: () => import("@remotion/google-fonts/Caveat") },
]

export const DEFAULT_FONT = "Inter"

export function findFont(family: string) {
  return FONTS.find((font) => font.family === family)
}

/** The closest weight the font actually ships in that style (e.g. 800 → 400 for Bebas Neue). */
export function nearestWeight(font: FontDef, weight: number, style: FontStyle = "normal") {
  const weights = style === "italic" && font.italics?.length ? font.italics : font.weights
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0])
}

/** Whether the font has real italics (otherwise the browser slants the upright one). */
export function hasItalic(family: string) {
  return Boolean(findFont(family)?.italics?.length)
}

/** CSS font-family with a fallback, for anywhere a text clip is drawn. */
export function fontStack(family: string) {
  const font = findFont(family)
  const fallback = font?.category === "Serif" ? "serif" : font?.category === "Mono" ? "monospace" : "sans-serif"
  return `"${family}", ${fallback}`
}

const loading = new Map<string, Promise<void>>()

/**
 * Loads one weight (and style) of a curated font (Latin only) into the page. Cached, never
 * rejects: if it fails the text falls back to the stack's generic family.
 */
export function loadFont(family: string, weight: number, style: FontStyle = "normal"): Promise<void> {
  const font = findFont(family)
  if (!font) return Promise.resolve()
  // No italics: load the upright face; the browser slants it.
  const fontStyle: FontStyle = style === "italic" && font.italics?.length ? "italic" : "normal"
  const actual = nearestWeight(font, weight, fontStyle)
  const key = `${family}:${actual}:${fontStyle}`
  let promise = loading.get(key)
  if (!promise) {
    promise = font
      .load()
      .then((module) =>
        module
          .loadFont(fontStyle, { weights: [String(actual)], subsets: ["latin"], ignoreTooManyRequestsWarning: true })
          .waitUntilDone()
      )
      .then(() => undefined)
      .catch(() => undefined)
    loading.set(key, promise)
  }
  return promise
}

/** Every weight and italic of a curated font (code clips choose weights and styles in their own code). */
export function loadFontFamily(family: string): Promise<void> {
  const font = findFont(family)
  if (!font) return Promise.resolve()
  return Promise.all([
    ...font.weights.map((weight) => loadFont(family, weight)),
    ...(font.italics ?? []).map((weight) => loadFont(family, weight, "italic")),
  ]).then(() => undefined)
}
