"use client"

import { PillButton } from "@/components/brand/pill-button"
import { useNewProjectDialog } from "@/stores/new-project-dialog"

export function NewProjectButton(props: Omit<React.ComponentProps<typeof PillButton>, "onClick">) {
  const setOpen = useNewProjectDialog((state) => state.setOpen)
  return <PillButton {...props} onClick={() => setOpen(true)} />
}
