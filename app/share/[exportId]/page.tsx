import { DownloadIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Logo } from "@/components/brand/logo"
import { pillButtonVariants } from "@/components/brand/pill-button"
import { ThemeToggle } from "@/components/nav/theme-toggle"
import { SharePlayer } from "@/components/share/share-player"
import { Skeleton } from "@/components/ui/skeleton"
import { APP_NAME } from "@/lib/brand"
import { getSharedExport } from "@/lib/exports"
import { timeAgo } from "@/lib/time"

/*
 * The public share page for an export (see the plan, §9): anyone with the link can watch it
 * (HLS from ImageKit) and download the MP4. No sign-in; only finished exports are found.
 */

export async function generateMetadata({ params }: PageProps<"/share/[exportId]">): Promise<Metadata> {
  const { exportId } = await params
  const shared = await getSharedExport(exportId)
  return {
    title: shared ? `${shared.projectName} · ${APP_NAME}` : `Video not found · ${APP_NAME}`,
    // Shared by link only: keep these pages out of search results.
    robots: { index: false, follow: false },
  }
}

export default function SharePage({ params }: PageProps<"/share/[exportId]">) {
  return (
    <div className="flex min-h-svh flex-col gap-6 px-4 py-5 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo className="text-[28px]" />
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-5">
        <Suspense fallback={<ShareSkeleton />}>
          <SharedVideo params={params} />
        </Suspense>
      </main>
    </div>
  )
}

async function SharedVideo({ params }: Pick<PageProps<"/share/[exportId]">, "params">) {
  const { exportId } = await params
  const shared = await getSharedExport(exportId)
  if (!shared) notFound()

  return (
    <>
      <SharePlayer exportId={shared.id} mp4Url={shared.mp4Url} width={shared.width} height={shared.height} />
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-(family-name:--font-display) text-2xl font-extrabold tracking-[-0.02em]">{shared.projectName}</h1>
          {shared.finishedAt && <p className="text-sm text-muted-foreground">Exported {timeAgo(shared.finishedAt)}</p>}
        </div>
        <a href={shared.mp4Url} download className={pillButtonVariants({ size: "md" })}>
          <DownloadIcon />
          Download MP4
        </a>
      </div>
    </>
  )
}

function ShareSkeleton() {
  return (
    <>
      <Skeleton className="aspect-video w-full max-w-3xl rounded-2xl" />
      <div className="flex w-full max-w-3xl items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>
    </>
  )
}
