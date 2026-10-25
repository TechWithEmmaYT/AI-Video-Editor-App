import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = { title: "Create account" }

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="New account"
      title="Make your account."
      description="Then connect Claude Code and start editing together."
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
