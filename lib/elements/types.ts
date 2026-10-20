import type { ParamDef } from "@/lib/project/schema"

export const ELEMENT_CATEGORIES = [
  { id: "titles", label: "Titles" },
  { id: "lower-thirds", label: "Lower thirds" },
  { id: "logos", label: "Logos" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "transitions", label: "Transitions" },
  { id: "callouts", label: "Callouts" },
] as const

export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number]["id"]

/** Where an element's box sits on the canvas when it's added (see lib/elements/place.ts). */
export type ElementLayout = "full" | "title" | "lower-third" | "square" | "callout"

export const ELEMENT_LAYOUTS: ElementLayout[] = ["full", "title", "lower-third", "square", "callout"]

/** A reusable code clip: a built-in, or one the user or Claude saved ("Mine"). */
export type ElementDef = {
  id: string
  name: string
  category: ElementCategory
  code: string
  paramSchema: ParamDef[]
  defaultParams: Record<string, unknown>
  fonts: string[]
  defaultDurationInFrames: number
  layout: ElementLayout
  createdBy: "builtin" | "user" | "claude"
}
