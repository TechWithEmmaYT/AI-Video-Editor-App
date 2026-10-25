import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"

import { SiteHeader } from "@/components/nav/site-header"
import { ThemeToggle } from "@/components/nav/theme-toggle"
import { UserMenu } from "@/components/nav/user-menu"
import { NewProjectButton } from "@/components/new-project/new-project-button"
import { requireSession } from "@/lib/session"

type Section = "projects" | "keys"

// Autopilot and Guide are plain text in v1 (see the plan).
const ITEMS: { label: string; section?: Section; href?: string }[] = [
  { label: "Projects", section: "projects", href: "/app" },
  { label: "Autopilot" },
  { label: "Guide" },
  { label: "Claude & keys", section: "keys", href: "/app/settings" },
]

export function AppHeader({ active }: { active: Section }) {
  return (
    <SiteHeader
      logoHref="/app"
      center={ITEMS.map((item) => {
        const className = cn(
          "rounded-full px-4 py-2 text-[15px] transition-colors",
          item.section === active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
          item.href && item.section !== active && "hover:text-foreground"
        )
        return item.href ? (
          <Link key={item.label} href={item.href} className={className}>
            {item.label}
          </Link>
        ) : (
          <span key={item.label} className={className}>
            {item.label}
          </span>
        )
      })}
    >
      <ThemeToggle />
      <NewProjectButton variant="secondary" size="sm" className="hidden sm:inline-flex">
        <PlusIcon />
        New project
      </NewProjectButton>
      <Suspense fallback={<span className="size-11 rounded-full bg-muted" />}>
        <AccountMenu />
      </Suspense>
    </SiteHeader>
  )
}

async function AccountMenu() {
  const { user } = await requireSession()
  return <UserMenu name={user.name} email={user.email} />
}
