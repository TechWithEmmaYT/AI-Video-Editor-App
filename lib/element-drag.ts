import type { ElementDef } from "@/lib/elements/types"

/*
 * Drag contract: Elements tab card → timeline. The payload is the whole element (built-ins and
 * saved ones alike), so the timeline can build the code clip without looking anything up.
 * The server validates the code again when the drop is saved.
 */

export const ELEMENT_DRAG_TYPE = "application/x-motion-element"

export function setElementDragData(event: { dataTransfer: DataTransfer | null }, element: ElementDef) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(ELEMENT_DRAG_TYPE, JSON.stringify(element))
  event.dataTransfer.effectAllowed = "copy"
}

/** Works during dragover, when only the types (not the data) can be read. */
export function hasElementDragData(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer?.types.includes(ELEMENT_DRAG_TYPE))
}

export function readElementDragData(dataTransfer: DataTransfer | null): ElementDef | null {
  try {
    const element = JSON.parse(dataTransfer?.getData(ELEMENT_DRAG_TYPE) || "null") as ElementDef | null
    const ok =
      element &&
      typeof element.id === "string" &&
      typeof element.name === "string" &&
      typeof element.code === "string" &&
      Array.isArray(element.paramSchema) &&
      Array.isArray(element.fonts) &&
      Number.isInteger(element.defaultDurationInFrames)
    return ok ? element : null
  } catch {
    return null
  }
}
