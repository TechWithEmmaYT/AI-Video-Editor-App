import { redirect } from "next/navigation"

import { getSession } from "@/lib/session"

/** Render inside <Suspense>: sends a signed-in visitor (valid session, not just a cookie) to /app. */
export async function RedirectIfSignedIn() {
  if (await getSession()) redirect("/app")
  return null
}
