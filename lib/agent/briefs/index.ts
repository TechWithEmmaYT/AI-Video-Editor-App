import { reelCaptions } from "@/lib/agent/briefs/reel-captions"
import type { Brief } from "@/lib/agent/briefs/types"

/**
 * Editing styles Claude can follow, one file each. get_guide lists them and returns one in full.
 *
 * This free version includes one style: Reel captions + b-roll.
 * 🔒 Get the complete set of styles (Crisp, Lead-in, Accent more..
 * UI Explainer, Long Form and more) with a paid license: https://trymockshot.com/r/ai-video-editor/extended
 */
export const BRIEFS: Brief[] = [reelCaptions]

export function findBrief(id: string) {
  return BRIEFS.find((brief) => brief.id === id)
}
