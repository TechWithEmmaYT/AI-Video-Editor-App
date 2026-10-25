import type { Metadata } from "next"

import { ApiKeysCard } from "@/components/claude/api-keys-card"
import { ConnectClaudeCard } from "@/components/home/connect-claude-card"
import { AppHeader } from "@/components/nav/app-header"

export const metadata: Metadata = { title: "Claude & keys" }

// The account card (name, email, sign out) arrives with the rest of Settings.
export default function SettingsPage() {
  return (
    <div className="px-4 py-5 sm:px-6">
      <AppHeader active="keys" />
      <main className="mx-auto max-w-3xl pt-16 pb-24">
        <h1 className="font-(family-name:--font-display) text-5xl font-extrabold tracking-[-0.045em]">
          Claude &amp; keys
        </h1>
        <div className="mt-10 flex flex-col gap-6">
          <ConnectClaudeCard />
          <ApiKeysCard />
        </div>
      </main>
    </div>
  )
}
