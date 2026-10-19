"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { PillButton } from "@/components/brand/pill-button"
import { FormatFrame } from "@/components/new-project/format-frame"
import { NewProjectButton } from "@/components/new-project/new-project-button"
import { getProjectsQueryFn, queryKeys } from "@/lib/api"
import { formatLength } from "@/lib/project/formats"
import { timeAgo } from "@/lib/time"
import type { Project } from "@/types/project"

export function ProjectList() {
  const { data: projects, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: getProjectsQueryFn,
  })

  if (isPending) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-[248px] animate-pulse rounded-[22px] bg-card" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-[28px] border border-border bg-card px-6 py-14 text-center">
        <p className="text-[17px] font-semibold">Couldn’t load your projects.</p>
        <p className="mt-2 text-[15px] text-muted-foreground">{error.message}</p>
        <PillButton variant="secondary" className="mt-6" onClick={() => refetch()}>
          Try again
        </PillButton>
      </div>
    )
  }

  if (projects.length === 0) return <EmptyState />

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/app/editor/${project.id}`}
      className="group overflow-hidden rounded-[22px] border border-border bg-card transition-colors outline-none hover:border-foreground/15 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="aspect-video bg-muted/70 transition-colors group-hover:bg-muted">
        <FormatFrame format={project.format} />
      </div>
      <div className="px-5 py-4">
        <p className="truncate text-[17px] font-semibold">{project.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.format} · {formatLength(project.durationInFrames, project.fps)} · Edited {timeAgo(project.updatedAt)}
        </p>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <section className="rounded-[28px] border border-border bg-card px-6 py-20 text-center">
      <h2 className="font-(family-name:--font-display) text-3xl font-extrabold tracking-[-0.03em]">
        Nothing here yet.
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted-foreground">
        Make a project and describe the video to Claude. Or open the demo to see one already built.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <NewProjectButton variant="secondary">New project</NewProjectButton>
        {/* The demo is display-only in v1 (see the plan). */}
        <PillButton variant="secondary">Open the demo</PillButton>
      </div>
    </section>
  )
}
