import { cn } from "cn"

import { Logo } from "@/components/brand/logo"

/** The floating rounded nav bar used on the landing page and inside the app. */
export function SiteHeader({
  logoHref = "/",
  center,
  children,
}: {
  logoHref?: string
  center?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 rounded-full border border-border bg-card/70 pr-2 pl-6 backdrop-blur">
      <Logo href={logoHref} />
      {center && <nav className="mx-auto hidden items-center gap-1 md:flex">{center}</nav>}
      {/* With center links, those links (mx-auto) push this group right from md up. */}
      <div className={cn("ml-auto flex items-center gap-2", center && "md:ml-0")}>{children}</div>
    </header>
  )
}
