import { cn } from "cn"

import type { ProjectFormat } from "@/types/project"

const SHAPE: Record<ProjectFormat, string> = {
  "16:9": "aspect-video w-[62%]",
  "9:16": "aspect-[9/16] h-[62%]",
  "1:1": "aspect-square h-[50%]",
}

/** The orange outline that previews a format's shape (frames.png). Fills its parent. */
export function FormatFrame({ format, className }: { format: ProjectFormat; className?: string }) {
  return (
    <div className={cn("grid size-full place-items-center", className)}>
      <div className={cn("rounded-[22%_/_14%] border-2 border-primary bg-primary/12", SHAPE[format])} />
    </div>
  )
}
