import type { Metadata } from "next"

import { ConnectClaudeCard } from "@/components/home/connect-claude-card"
import { AppHeader } from "@/components/nav/app-header"

export const metadata: Metadata = { title: "Claude & keys" }

// Account, API keys and the full settings card arrive in Phase 2.
export default function SettingsPage() {
  return (
    <div className="px-4 py-5 sm:px-6">
      <AppHeader active="keys" />
      <main className="mx-auto max-w-2xl pt-16 pb-24">
        <h1 className="font-(family-name:--font-display) text-5xl font-extrabold tracking-[-0.045em]">
          Claude &amp; keys
        </h1>
        <div className="mt-10">
          <ConnectClaudeCard />
        </div>
      </main>
    </div>
  )
}
