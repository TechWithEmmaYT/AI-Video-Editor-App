import { circleReveal, shapeGrow, wipe } from "@/lib/elements/builtin/transitions"
import { arrowPointer, badgePop, highlightBox } from "@/lib/elements/builtin/callouts"
import { checklistCard, quoteCard, statCard } from "@/lib/elements/builtin/cards"
import { accentCaption, crispCaption, heavyCaption, kineticCaption, leadInCaption } from "@/lib/elements/builtin/captions"
import { dotGrid, gradientMesh, noiseWaves, solidColour } from "@/lib/elements/builtin/backgrounds"
import { logoSpin, svgLogoReveal } from "@/lib/elements/builtin/logos"
import { barLowerThird, pillNameTag } from "@/lib/elements/builtin/lower-thirds"
import { bigTitle, kineticWords, typewriter } from "@/lib/elements/builtin/titles"
import type { ElementDef } from "@/lib/elements/types"

/** The built-in elements (see the plan, §7), in panel order. */
export const BUILTIN_ELEMENTS: ElementDef[] = [
  crispCaption,
  leadInCaption,
  accentCaption,
  heavyCaption,
  bigTitle,
  kineticWords,
  kineticCaption,
  typewriter,
  barLowerThird,
  pillNameTag,
  svgLogoReveal,
  logoSpin,
  gradientMesh,
  dotGrid,
  noiseWaves,
  solidColour,
  wipe,
  shapeGrow,
  circleReveal,
  arrowPointer,
  highlightBox,
  badgePop,
  checklistCard,
  statCard,
  quoteCard,
]

export function findBuiltinElement(id: string) {
  return BUILTIN_ELEMENTS.find((element) => element.id === id)
}
