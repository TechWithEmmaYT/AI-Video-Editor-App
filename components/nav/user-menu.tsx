"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { LogOutIcon, KeyRoundIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutMutationFn } from "@/lib/api"

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { mutate: onSignOut } = useMutation({
    mutationFn: signOutMutationFn,
    onSuccess: () => {
      queryClient.clear() // drop the signed-out user's cached data
      router.replace("/sign-in")
      router.refresh()
    },
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[#6f8796] text-lg font-medium text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {name.charAt(0).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-60 rounded-2xl p-1.5">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/app/settings" />}>
          <KeyRoundIcon />
          Claude &amp; keys
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSignOut()}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
