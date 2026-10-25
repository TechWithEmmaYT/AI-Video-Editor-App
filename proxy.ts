import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Optimistic check only: it looks for the session cookie, not a valid session.
// Pages and route handlers still verify the session with `getSession()`.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()

  const signIn = new URL("/sign-in", request.url)
  signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: ["/app/:path*"],
}
