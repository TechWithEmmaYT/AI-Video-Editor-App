import { longForm } from "@/lib/agent/briefs/long-form"
import { markerReel } from "@/lib/agent/briefs/marker-reel"
import { reelCaptions } from "@/lib/agent/briefs/reel-captions"
import { stackedReel } from "@/lib/agent/briefs/stacked-reel"
import { uiExplainer } from "@/lib/agent/briefs/ui-explainer"
import type { Brief } from "@/lib/agent/briefs/types"

/** Editing styles Claude can follow, one file each. get_guide lists them and returns one in full. */
export const BRIEFS: Brief[] = [reelCaptions, markerReel, stackedReel, uiExplainer, longForm]

export function findBrief(id: string) {
  return BRIEFS.find((brief) => brief.id === id)
}
