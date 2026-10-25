import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Editor } from "@/components/editor/editor"
import { EditorSkeleton } from "@/components/editor/editor-skeleton"
import { getProjectWithDoc } from "@/lib/projects"
import { requireSession } from "@/lib/session"

export const metadata: Metadata = { title: "Editor" }

export default function EditorPage({ params }: PageProps<"/app/editor/[projectId]">) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorLoader params={params} />
    </Suspense>
  )
}

async function EditorLoader({ params }: Pick<PageProps<"/app/editor/[projectId]">, "params">) {
  const { user } = await requireSession()
  const { projectId } = await params
  const project = await getProjectWithDoc(user.id, projectId)
  if (!project) notFound()

  return <Editor key={project.id} project={project} />
}
