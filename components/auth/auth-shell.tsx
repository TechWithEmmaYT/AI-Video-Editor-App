import { Suspense } from "react"

import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in"
import { Logo } from "@/components/brand/logo"

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col px-4 py-6 sm:px-6">
      {/* The session read streams in, so the page itself stays a static shell. */}
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <header className="mx-auto w-full max-w-5xl">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[440px] rounded-[28px] border border-border bg-card p-7 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.6)] sm:p-9">
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</p>
          <h1 className="mt-2 font-(family-name:--font-display) text-[40px] leading-[1.02] font-extrabold tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
