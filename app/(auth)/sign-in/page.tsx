import type { Metadata } from "next"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <AuthShell eyebrow="Welcome back" title="Sign in." description="Pick up your projects where you left them.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
