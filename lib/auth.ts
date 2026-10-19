import { apiKey } from "@better-auth/api-key"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/db"
import * as schema from "@/db/schema"
import { APP_NAME } from "@/lib/brand"

const DAY = 60 * 60 * 24

export const auth = betterAuth({
  appName: APP_NAME,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 7 * DAY,
    updateAge: DAY,
  },
  plugins: [
    // Keys are what Claude Code sends over MCP.
    apiKey({
      defaultPrefix: "motion_",
      keyExpiration: { defaultExpiresIn: 7 * DAY * 1000 },
      // The plugin default is 10 requests per day, far too low for an agent making tool calls.
      rateLimit: { enabled: true, timeWindow: 60 * 1000, maxRequests: 120 },
    }),
    // nextCookies must stay last so cookies set by server actions reach the browser.
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
