import type { LucideIcon } from "lucide-react"

/** Stand-in for tabs that are built in later phases of the plan. */
export function PanelPlaceholder({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <Icon className="size-7 text-muted-foreground/70" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-[230px] text-[13px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}
