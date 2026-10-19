import Link from "next/link"
import { cn } from "cn"

import { APP_NAME } from "@/lib/brand"

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "font-(family-name:--font-logo) text-[34px] leading-none font-bold tracking-[-0.03em] text-foreground",
        className
      )}
    >
      {APP_NAME}
    </Link>
  )
}
