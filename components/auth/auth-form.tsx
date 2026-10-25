"use client"

import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { FilledInput } from "@/components/brand/filled-input"
import { PillButton } from "@/components/brand/pill-button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { signInMutationFn, signUpMutationFn } from "@/lib/api"
import { APP_NAME } from "@/lib/brand"
import { safeNext } from "@/lib/safe-next"

type Mode = "sign-in" | "sign-up"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()

  const { mutate, isPending: pending, isSuccess, error } = useMutation({
    mutationFn: (form: FormData) => {
      const email = String(form.get("email") ?? "").trim()
      const password = String(form.get("password") ?? "")
      return mode === "sign-up"
        ? signUpMutationFn({ name: String(form.get("name") ?? "").trim(), email, password })
        : signInMutationFn({ email, password })
    },
    onSuccess: () => {
      // Read at submit time (not via searchParams) so the page stays a static shell.
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next") ?? undefined))
      router.refresh()
    },
  })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutate(new FormData(event.currentTarget))
  }

  const isSignUp = mode === "sign-up"

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup className="gap-5">
        {isSignUp && (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <FilledInput id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FilledInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FilledInput
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder={isSignUp ? "At least 8 characters" : "Your password"}
            minLength={8}
            required
          />
        </Field>

        {error && <FieldError className="rounded-xl bg-destructive/10 px-4 py-3">{error.message}</FieldError>}

        {/* Stays busy after success too, while the redirect happens. */}
        <PillButton type="submit" size="lg" className="mt-2 w-full" disabled={pending || isSuccess}>
          {(pending || isSuccess) && <Spinner />}
          {isSignUp ? "Create account" : "Sign in"}
        </PillButton>
      </FieldGroup>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : `New to ${APP_NAME}? `}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-semibold text-primary hover:underline">
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}
