import { CodeXmlIcon, ImageIcon, MusicIcon, TypeIcon, VideoIcon, type LucideIcon } from "lucide-react"

import type { ClipType } from "@/lib/project/schema"

/** Label, icon and colour for each clip type (timeline blocks, track chips, panel header). */
export const CLIP_META: Record<ClipType, { label: string; icon: LucideIcon; color: string }> = {
  code: { label: "Code", icon: CodeXmlIcon, color: "var(--clip-code)" },
  text: { label: "Text", icon: TypeIcon, color: "var(--clip-text)" },
  video: { label: "Video", icon: VideoIcon, color: "var(--clip-video)" },
  image: { label: "Image", icon: ImageIcon, color: "var(--clip-image)" },
  audio: { label: "Audio", icon: MusicIcon, color: "var(--clip-audio)" },
}
