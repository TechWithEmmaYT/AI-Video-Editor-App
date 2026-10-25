import { findTextPreset, type TextPresetId } from "@/lib/project/text-presets"

/*
 * Drag contract: Text tab preset card → timeline. Same idea as lib/media-drag.ts, with the
 * preset id as the payload (the timeline builds the clip at the drop spot).
 */

export const TEXT_PRESET_DRAG_TYPE = "application/x-motion-text-preset"

export function setTextPresetDragData(event: { dataTransfer: DataTransfer | null }, presetId: TextPresetId) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData(TEXT_PRESET_DRAG_TYPE, presetId)
  event.dataTransfer.effectAllowed = "copy"
}

/** Works during dragover, when only the types (not the data) can be read. */
export function hasTextPresetDragData(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer?.types.includes(TEXT_PRESET_DRAG_TYPE))
}

export function readTextPresetDragData(dataTransfer: DataTransfer | null): TextPresetId | null {
  const id = dataTransfer?.getData(TEXT_PRESET_DRAG_TYPE)
  return id && findTextPreset(id) ? (id as TextPresetId) : null
}
