import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

// The demo and the guide are display-only in v1 (see the plan).
const LINKS = [
  { title: "Open the demo", description: "A finished 15-second project, to poke at.", href: null },
  { title: "API keys", description: "For Claude on another machine, or a script.", href: "/app/settings" },
  { title: "The guide", description: "Everything, step by step, with pictures.", href: null },
] as const

const cardClass =
  "group flex items-center gap-4 rounded-[22px] border border-border bg-card px-6 py-5 transition-colors"

export function QuickLinks() {
  return (
    <div className="flex flex-col gap-4">
      {LINKS.map((link) => {
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold">{link.title}</p>
              <p className="mt-0.5 text-[15px] text-muted-foreground">{link.description}</p>
            </div>
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </>
        )
        return link.href ? (
          <Link key={link.title} href={link.href} className={`${cardClass} hover:bg-muted`}>
            {body}
          </Link>
        ) : (
          <div key={link.title} className={cardClass}>
            {body}
          </div>
        )
      })}
    </div>
  )
}
