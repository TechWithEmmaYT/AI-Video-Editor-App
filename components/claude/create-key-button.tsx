"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { KeyRoundIcon, TriangleAlertIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { TerminalCommand } from "@/components/claude/terminal-command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { mcpAddCommand } from "@/lib/agent/connect"
import { createApiKeyMutationFn, queryKeys } from "@/lib/api"

const EXPIRY_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: null, label: "Never" },
] as const

/**
 * "Create key" and its dialog: name + expiry (7 days by default), then the key, shown once, with the
 * connect command filled in. Used by the editor's Claude tab and the Settings page.
 */
export function CreateKeyButton({
  label = "Create key",
  onCreated,
  className,
}: {
  label?: string
  onCreated?: (key: string) => void
  className?: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("Claude Code")
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7)
  const [key, setKey] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: createApiKeyMutationFn,
    onSuccess: (result) => {
      setKey(result.key)
      onCreated?.(result.key)
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys })
    },
    onError: (error) => toast.error("Couldn't create the key", { description: error.message }),
  })

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setKey(null)
          setOpen(true)
        }}
        className={cn(
          "flex h-9 w-fit items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]",
          className
        )}
      >
        <KeyRoundIcon className="size-4" />
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {key ? (
            <>
              <DialogHeader>
                <DialogTitle>Your API key</DialogTitle>
                <DialogDescription>Copy it now. You won&apos;t be able to see it again.</DialogDescription>
              </DialogHeader>
              <div className="flex min-w-0 flex-col gap-3">
                <TerminalCommand text={key} prompt={false} />
                <p className="text-[13px] font-semibold">Run this in your terminal</p>
                <TerminalCommand text={mcpAddCommand(key)} />
                <p className="flex gap-2 text-xs text-muted-foreground">
                  <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                  Anyone with this key can edit your projects. Don&apos;t share it or commit it.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create an API key</DialogTitle>
                <DialogDescription>Claude Code sends this key with every request. It only sees your projects.</DialogDescription>
              </DialogHeader>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  create.mutate({ name: name.trim() || "Claude Code", expiresInDays })
                }}
              >
                <label className="flex flex-col gap-1.5 text-[13px]">
                  <span className="font-medium">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={32}
                    className="h-10 rounded-xl bg-muted/60 px-3 outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </label>
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <span className="font-medium">Expires</span>
                  <div role="radiogroup" aria-label="Expires" className="flex gap-1 rounded-xl bg-muted/60 p-1">
                    {EXPIRY_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={expiresInDays === option.days}
                        onClick={() => setExpiresInDays(option.days)}
                        className={cn(
                          "h-8 flex-1 rounded-lg text-xs font-medium transition-colors",
                          expiresInDays === option.days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="h-10 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {create.isPending ? "Creating…" : "Create key"}
                </button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
