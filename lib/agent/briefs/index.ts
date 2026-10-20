import { longForm } from "@/lib/agent/briefs/long-form"
import { reelCaptions } from "@/lib/agent/briefs/reel-captions"
import type { Brief } from "@/lib/agent/briefs/types"

/** Editing styles Claude can follow, one file each. get_guide lists them and returns one in full. */
export const BRIEFS: Brief[] = [reelCaptions, longForm]

export function findBrief(id: string) {
  return BRIEFS.find((brief) => brief.id === id)
}
