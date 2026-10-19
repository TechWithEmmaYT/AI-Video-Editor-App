import { create } from "zustand"

/** Lets any "New project" button open the one dialog mounted in app/app/layout.tsx. */
export const useNewProjectDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
