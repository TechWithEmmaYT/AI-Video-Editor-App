import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { Greeting } from "@/components/greeting"
import { ConnectClaudeCard } from "@/components/home/connect-claude-card"
import { ProjectList } from "@/components/home/project-list"
import { QuickLinks } from "@/components/home/quick-links"
import { AppHeader } from "@/components/nav/app-header"
import { NewProjectButton } from "@/components/new-project/new-project-button"
import { requireSession } from "@/lib/session"

export const metadata: Metadata = { title: "Your projects" }

// Home. A static shell: the greeting reads the session behind <Suspense>,
// and the project list loads on the client with TanStack Query.
export default function HomePage() {
  return (
    <div className="px-4 py-5 sm:px-6">
      <AppHeader active="projects" />

      <main className="mx-auto max-w-5xl pt-16 pb-24">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="h-6 text-[15px] text-muted-foreground">
              <Suspense>
                <UserGreeting />
              </Suspense>
            </p>
            <h1 className="mt-2 font-(family-name:--font-display) text-5xl font-extrabold tracking-[-0.045em] sm:text-[64px]">
              Your projects
            </h1>
          </div>
          <NewProjectButton size="lg">
            <PlusIcon className="size-5" />
            New project
          </NewProjectButton>
        </div>

        <ProjectList />

        <div className="mt-14 grid gap-5 lg:grid-cols-[3fr_2fr]">
          <ConnectClaudeCard />
          <QuickLinks />
        </div>
      </main>
    </div>
  )
}

async function UserGreeting() {
  const { user } = await requireSession()
  return <Greeting name={user.name} />
}
