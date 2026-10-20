import { circleReveal, wipe } from "@/lib/elements/builtin/transitions"
import { arrowPointer, badgePop, highlightBox } from "@/lib/elements/builtin/callouts"
import { dotGrid, gradientMesh, noiseWaves } from "@/lib/elements/builtin/backgrounds"
import { logoSpin, svgLogoReveal } from "@/lib/elements/builtin/logos"
import { barLowerThird, pillNameTag } from "@/lib/elements/builtin/lower-thirds"
import { bigTitle, kineticWords, typewriter } from "@/lib/elements/builtin/titles"
import type { ElementDef } from "@/lib/elements/types"

/** The built-in elements (see the plan, §7), in panel order. */
export const BUILTIN_ELEMENTS: ElementDef[] = [
  bigTitle,
  kineticWords,
  typewriter,
  barLowerThird,
  pillNameTag,
  svgLogoReveal,
  logoSpin,
  gradientMesh,
  dotGrid,
  noiseWaves,
  wipe,
  circleReveal,
  arrowPointer,
  highlightBox,
  badgePop,
]

export function findBuiltinElement(id: string) {
  return BUILTIN_ELEMENTS.find((element) => element.id === id)
}
