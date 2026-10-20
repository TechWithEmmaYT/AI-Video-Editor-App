"use client"

import { useQuery } from "@tanstack/react-query"
import { MousePointerClickIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "cn"

import { CreateKeyButton } from "@/components/claude/create-key-button"
import { TerminalCommand } from "@/components/claude/terminal-command"
import { CLIP_META } from "@/components/editor/clip-meta"
import { mcpAddCommand } from "@/lib/agent/connect"
import { getClaudeStatusQueryFn, queryKeys } from "@/lib/api"
import { timeAgo } from "@/lib/time"
import { useEditorStore, useSelectedClip } from "@/stores/editor-store"

/** Claude counts as "Working…" this long after its last MCP request. */
const WORKING_MS = 10_000

/** Claude tab: connection status, the connect command (with Create key), and what "this" means. */
export function ClaudePanel() {
  // A key created here, kept only while the panel is open: the server stores a hash, never the key.
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <ClaudeStatus />

      <section className="flex flex-col gap-3">
        <h3 className="px-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Connect Claude Code</h3>
        <Step n={1} title="Create an API key">
          <CreateKeyButton label={createdKey ? "Create another key" : "Create key"} onCreated={setCreatedKey} />
        </Step>
        <Step n={2} title="Run this in your terminal">
          <TerminalCommand text={mcpAddCommand(createdKey ?? undefined)} />
          {!createdKey && (
            <p className="text-xs text-muted-foreground">
              Replace <code className="font-mono text-foreground">&lt;your-api-key&gt;</code> with your key.
            </p>
          )}
        </Step>
        <Step n={3} title='Ask Claude to edit "this"'>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Keep this project open. Claude edits it live, and the status above turns to <em>Working…</em>.
          </p>
        </Step>
      </section>

      <ThisCard />

      <p className="px-1 text-xs text-muted-foreground">
        Keys expire after 7 days unless you choose otherwise.{" "}
        <Link href="/app/settings" className="font-medium text-foreground hover:underline">
          Manage keys
        </Link>
      </p>
    </div>
  )
}

// ── Status ──────────────────────────────────────────────────────────────

function ClaudeStatus() {
  // Checked every few seconds while this tab is open (live events replace this with the realtime phase).
  const { data: lastSeenAt, isPending, isError } = useQuery({
    queryKey: queryKeys.claudeStatus,
    queryFn: getClaudeStatusQueryFn,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })
  const now = useNow(5_000)

  const seenMs = lastSeenAt ? now - new Date(lastSeenAt).getTime() : null
  const state = isError
    ? "error"
    : isPending
      ? "loading"
      : seenMs === null
        ? "never"
        : seenMs < WORKING_MS
          ? "working"
          : "connected"
  const label = {
    error: "Status unavailable",
    loading: "Checking…",
    never: "Not connected",
    working: "Working…",
    connected: `Connected · seen ${lastSeenAt ? timeAgo(lastSeenAt, now) : ""}`,
  }[state]

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5" role="status" aria-live="polite">
      <span className="relative flex size-2.5 shrink-0">
        {state === "working" && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />}
        <span
          className={cn(
            "relative size-2.5 rounded-full",
            state === "working" || state === "connected" ? "bg-emerald-500" : "bg-muted-foreground/50"
          )}
        />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">
          {state === "never"
            ? "Claude Code hasn't connected with a key yet."
            : state === "error"
              ? "Couldn't check the connection. Retrying…"
              : "Claude Code over MCP"}
        </p>
      </div>
    </div>
  )
}

/** The current time, refreshed every `ms` (for "seen 2 minutes ago"). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

// ── Connect ─────────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-muted/60 p-4">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-background text-xs font-semibold">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[13px] font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}

// ── "This" ──────────────────────────────────────────────────────────────

/** What Claude takes "this" to mean right now: the open project, and the selected clip if any. */
function ThisCard() {
  const projectName = useEditorStore((state) => state.data.name)
  const clip = useSelectedClip()

  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">&ldquo;This&rdquo; means</h3>
      <div className="flex flex-col divide-y divide-border rounded-2xl bg-muted/60 text-[13px]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-muted-foreground">Project</span>
          <span className="truncate font-medium">{projectName}</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-muted-foreground">Clip</span>
          {clip ? (
            <span className="truncate font-medium">
              {clip.name} · {CLIP_META[clip.type].label}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MousePointerClickIcon className="size-3.5" />
              None selected
            </span>
          )}
        </div>
      </div>
      <p className="px-1 text-xs text-muted-foreground">Select a clip and &ldquo;this&rdquo; becomes that clip.</p>
    </section>
  )
}
