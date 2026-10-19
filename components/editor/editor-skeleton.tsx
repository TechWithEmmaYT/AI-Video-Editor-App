import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { APP_NAME } from "@/lib/brand"

/** Shown while the project loads: the editor's layout in grey, with the logo and a spinner in the middle. */
export function EditorSkeleton() {
  return (
    <div className="relative flex h-svh flex-col overflow-hidden border-t-2 border-primary bg-background" aria-busy>
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-5 w-36" />
        <div className="ml-auto flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 px-3">
        <div className="flex w-90 shrink-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-3">
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="aspect-video rounded-xl" />
            <Skeleton className="aspect-video rounded-xl" />
          </div>
        </div>
        <div className="min-w-0 flex-1 rounded-[22px] border border-border bg-(--editor-canvas)" />
      </div>

      <div className="mx-3 mt-6 mb-3 flex h-70 shrink-0 flex-col gap-3 rounded-[22px] border border-border bg-card p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex gap-2">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="size-10 rounded-xl" />
          </div>
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-6 w-48 justify-self-end rounded-full" />
        </div>
        <Skeleton className="h-6" />
        {[0.55, 0.8, 0.4].map((width) => (
          <div key={width} className="flex gap-3">
            <Skeleton className="h-10 w-44 shrink-0 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" style={{ width: `${width * 100}%` }} />
          </div>
        ))}
      </div>

      {/* The logo and spinner float over the middle of the page. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <span className="font-(family-name:--font-logo) text-[44px] leading-none font-bold tracking-[-0.03em] text-foreground">
          {APP_NAME}
        </span>
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    </div>
  )
}
