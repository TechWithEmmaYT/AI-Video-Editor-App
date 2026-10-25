import Link from "next/link"
import { cn } from "cn"

import { PillButton } from "@/components/brand/pill-button"
import { SiteHeader } from "@/components/nav/site-header"
import { ThemeToggle } from "@/components/nav/theme-toggle"

/*
 * Tilted 3D prompt pills floating around the hero, as in _designs/image.png.
 *
 * Positions are measured from the centre of the hero in units of the title's font size
 * (--hero-fs), not in % of the container, so they always sit in the gutter beside the text:
 * line 1 ("Automate it.") is about 6.6 × --hero-fs wide, the paragraph is max 576px wide.
 * Long pills go next to line 1 (the narrower line); short ones next to the paragraph.
 * The longest pill only fits from 1440px up.
 */
const PROMPTS = [
  {
    text: "“make the hook more aggressive”",
    className:
      "hidden min-[1440px]:block top-[calc(var(--hero-fs)*0.18)] right-[calc(50%+var(--hero-fs)*3.45+12px)] -rotate-[7deg] bg-[#ef4b4b] text-white shadow-[0_6px_0_0_#b0302f]",
  },
  {
    text: "“adapt this to portrait”",
    className:
      "top-[calc(var(--hero-fs)*-0.62)] left-[calc(50%+var(--hero-fs)*0.4)] -rotate-[3deg] bg-[#2f7cf0] text-white shadow-[0_6px_0_0_#1d57b5]",
  },
  {
    text: "“slam it in”",
    className:
      "top-[calc(var(--hero-fs)*0.22)] left-[calc(50%+var(--hero-fs)*3.45+20px)] rotate-[6deg] bg-[#f5c518] text-[#3a2c00] shadow-[0_6px_0_0_#bf960a]",
  },
  {
    text: "“orange, please”",
    className:
      "top-[calc(var(--hero-fs)*1.84+56px)] right-[calc(50%+300px)] rotate-[5deg] bg-[#ff5c1a] text-white shadow-[0_6px_0_0_#c23e09]",
  },
  {
    text: "“Inter Tight, everywhere”",
    className:
      "top-[calc(var(--hero-fs)*1.84+40px)] left-[calc(50%+300px)] rotate-[3deg] bg-[#8f4ef0] text-white shadow-[0_6px_0_0_#6831ba]",
  },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip px-4 py-5 sm:px-6">
      <SiteHeader>
        <ThemeToggle />
        <PillButton variant="ghost" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
          Sign in
        </PillButton>
        <PillButton size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
          Get started
        </PillButton>
      </SiteHeader>

      <main className="flex flex-1 flex-col items-center justify-center py-28 text-center [--hero-fs:clamp(3.25rem,8.5vw,6.75rem)]">
        <div className="relative w-full">
          {/* Only from xl up: below that the gutters are too narrow and the pills would cover the text. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
            {PROMPTS.map((prompt) => (
              <span
                key={prompt.text}
                className={cn(
                  "absolute rounded-full px-5 py-2 font-mono text-[13px] font-bold whitespace-nowrap italic",
                  prompt.className
                )}
              >
                {prompt.text}
              </span>
            ))}
          </div>

          <h1 className="relative font-(family-name:--font-display) text-(length:--hero-fs) leading-[0.92] font-black tracking-[-0.045em] [word-spacing:0.04em]">
            Automate it.
            <br />
            Keep the look.
          </h1>
          <p className="relative mx-auto mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            An MCP for Claude Code. Claude edits your video live: your copy, your fonts, your colours, your assets.
            Every frame stays yours to edit.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <PillButton size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
            Get started
          </PillButton>
          <PillButton variant="secondary" size="lg" nativeButton={false} render={<Link href="/app" />}>
            New project
          </PillButton>
        </div>
      </main>
    </div>
  )
}
