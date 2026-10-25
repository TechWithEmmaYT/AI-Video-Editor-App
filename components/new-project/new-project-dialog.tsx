"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "cn"

import { FilledInput } from "@/components/brand/filled-input"
import { PillButton } from "@/components/brand/pill-button"
import { FormatFrame } from "@/components/new-project/format-frame"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { createProjectMutationFn, queryKeys } from "@/lib/api"
import { FORMAT_ORDER, FORMATS } from "@/lib/project/formats"
import { useNewProjectDialog } from "@/stores/new-project-dialog"
import type { Project, ProjectFormat } from "@/types/project"

export function NewProjectDialog() {
  const { open, setOpen } = useNewProjectDialog()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto rounded-[26px] border border-border bg-card p-0 text-sm ring-0 sm:max-w-[480px]"
      >
        {/* The popup unmounts when closed, so the form starts fresh on every open. */}
        <NewProjectForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [format, setFormat] = useState<ProjectFormat>("16:9")

  // Length is left out: the server starts every project at DEFAULT_SECONDS.
  const { mutate, isPending, error } = useMutation({
    mutationFn: createProjectMutationFn,
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, (old) => [project, ...(old ?? [])])
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects })
      onDone()
      router.push(`/app/editor/${project.id}`)
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isPending) mutate({ name, format })
  }

  const info = FORMATS[format]

  return (
    <form onSubmit={onSubmit}>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-5 pt-5">
        <DialogClose className="justify-self-start rounded-md text-[15px] text-primary outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50">
          Cancel
        </DialogClose>
        <DialogTitle className="text-[15px] font-semibold">New project</DialogTitle>
      </header>

      <div className="flex flex-col gap-6 px-5 pt-6 pb-5">
        <Section label="Name">
          <FilledInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Untitled"
            maxLength={80}
            autoFocus
            aria-label="Project name"
            className="h-11 text-sm md:text-sm"
          />
        </Section>

        <Section label="Format">
          <div className="rounded-[20px] bg-muted/60 p-2.5">
            <div role="radiogroup" aria-label="Format" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {FORMAT_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={format === value}
                  onClick={() => setFormat(value)}
                  className={cn(
                    "h-9 rounded-lg text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    format === value
                      ? "bg-(--pill-secondary) text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex items-center gap-4 px-1 pb-1">
              <div className="size-16 shrink-0 rounded-xl bg-background">
                <FormatFrame format={format} />
              </div>
              <div className="min-w-0">
                <p className="font-(family-name:--font-display) text-xl leading-tight font-extrabold tracking-[-0.03em]">
                  {info.label}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {info.width}×{info.height} · {info.usedFor}
                </p>
              </div>
            </div>
          </div>
        </Section>

        {error && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message}
          </p>
        )}

        <PillButton type="submit" className="w-full" disabled={isPending}>
          {isPending && <Spinner />}
          Create and open
        </PillButton>
      </div>
    </form>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">{label}</h3>
      {children}
    </section>
  )
}
