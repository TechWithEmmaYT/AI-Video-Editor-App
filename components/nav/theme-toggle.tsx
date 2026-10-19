"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {/* Both icons render; CSS picks one, so there's no hydration mismatch. */}
      <SunIcon className="hidden size-[18px] dark:block" />
      <MoonIcon className="size-[18px] dark:hidden" />
    </button>
  )
}
