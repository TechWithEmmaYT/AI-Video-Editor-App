"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { CreateKeyButton } from "@/components/claude/create-key-button"
import { Skeleton } from "@/components/ui/skeleton"
import { listApiKeysQueryFn, queryKeys, revokeApiKeyMutationFn } from "@/lib/api"
import { timeAgo } from "@/lib/time"
import type { ApiKeySummary } from "@/types/api"

/** Settings: the user's API keys. Create (shown once), see when each was used, revoke. */
export function ApiKeysCard() {
  const { data: keys, isPending, isError } = useQuery({ queryKey: queryKeys.apiKeys, queryFn: listApiKeysQueryFn })

  return (
    <section className="rounded-[28px] border border-border bg-(--card-raised) p-7 sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-(family-name:--font-display) text-[28px] leading-tight font-extrabold tracking-[-0.035em]">API keys</h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Claude Code sends one with every request. Revoke a key and its next request fails.
          </p>
        </div>
        <CreateKeyButton className="h-10 px-5 text-sm" />
      </div>

      <div className="mt-8">
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load your keys. Refresh to try again.</p>
        ) : keys.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
            <KeyRoundIcon className="size-4 shrink-0" />
            No keys yet. Create one to connect Claude Code.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((key) => (
              <KeyRow key={key.id} apiKey={key} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function KeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  // The time the row first rendered (reading the clock during render isn't pure).
  const [now] = useState(() => Date.now())
  const expired = apiKey.expiresAt !== null && new Date(apiKey.expiresAt).getTime() < now

  const revoke = useMutation({
    mutationFn: revokeApiKeyMutationFn,
    onSuccess: () => {
      queryClient.setQueryData<ApiKeySummary[]>(queryKeys.apiKeys, (list) => list?.filter((k) => k.id !== apiKey.id))
      toast.success(`Revoked "${apiKey.name ?? "key"}"`)
    },
    onError: (error) => toast.error("Couldn't revoke the key", { description: error.message }),
  })

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-muted/50 px-5 py-4">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-semibold">{apiKey.name || "Unnamed key"}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{apiKey.start ? `${apiKey.start}…` : "••••••"}</p>
      </div>
      <Detail label="Created" value={timeAgo(apiKey.createdAt)} />
      <Detail label="Last used" value={apiKey.lastUsedAt ? timeAgo(apiKey.lastUsedAt) : "Never"} />
      <Detail
        label="Expires"
        value={apiKey.expiresAt ? (expired ? "Expired" : timeAgo(apiKey.expiresAt)) : "Never"}
        warn={expired}
      />
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(apiKey.id)}
            className="h-8 rounded-full bg-destructive px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="h-8 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
        >
          Revoke
        </button>
      )}
    </li>
  )
}

function Detail({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className={warn ? "font-medium text-destructive" : "font-medium"}>{value}</p>
    </div>
  )
}
