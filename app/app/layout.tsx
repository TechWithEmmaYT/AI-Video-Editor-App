import { NewProjectDialog } from "@/components/new-project/new-project-dialog"

// No session read here: with cacheComponents a layout must stay a static shell.
// Pages read the session inside <Suspense>; proxy.ts handles the signed-out redirect.
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      {children}
      <NewProjectDialog />
    </>
  )
}
