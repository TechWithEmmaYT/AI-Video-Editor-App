import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"

import { additionalFiles } from "@trigger.dev/build/extensions/core"
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer"
import { defineConfig } from "@trigger.dev/sdk"

/**
 * The project ref (from the Trigger.dev dashboard → Project settings). The CLI doesn't read .env files
 * before loading this config, so read it from .env.local here; CI can set it as a real env var.
 */
function projectRef() {
  if (process.env.TRIGGER_PROJECT_REF) return process.env.TRIGGER_PROJECT_REF
  for (const file of [".env.local", ".env"]) {
    try {
      const ref = parseEnv(readFileSync(file, "utf8")).TRIGGER_PROJECT_REF
      if (ref) return ref
    } catch {}
  }
  return ""
}

export default defineConfig({
  project: projectRef(),
  dirs: ["./trigger"],
  maxDuration: 900, // seconds; a render of a short video fits well inside this
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000, randomize: true },
  },
  // Tasks run with the build folder as their working directory, in dev as when deployed.
  legacyDevProcessCwdBehaviour: false,
  build: {
    // Remotion's renderer ships native binaries per platform, so it's installed, not bundled.
    external: ["@remotion/renderer"],
    // keepNames wraps functions in esbuild's __name(); Remotion runs some functions inside Chrome,
    // where __name doesn't exist ("ReferenceError: __name is not defined").
    keepNames: false,
    extensions: [
      // Deployed: installs Chrome and sets PUPPETEER_EXECUTABLE_PATH for the render.
      puppeteer(),
      // The composition bundle (npm run remotion:bundle) the render task serves.
      additionalFiles({ files: [".remotion-bundle/**"] }),
    ],
  },
})
