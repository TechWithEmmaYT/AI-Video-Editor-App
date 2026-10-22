import path from "node:path"

import { logger, queue, task } from "@trigger.dev/sdk"

import type { RenderFramesOutput, RenderFramesPayload } from "@/lib/export/types"

/*
 * Claude's eyes (the render_frames tool): renders a few stills of the project with the same <Main>
 * composition as the export, so what Claude sees is what the video looks like. Media plays from
 * the ImageKit originals, like the export. The frames come back as small JPEGs in the run's output;
 * nothing is uploaded.
 */

/** One look at a time per user (triggered with concurrencyKey = userId). */
const looks = queue({ name: "frames", concurrencyLimit: 1 })

/** Built by scripts/bundle-remotion.mjs and shipped with the task (additionalFiles in trigger.config.ts). */
const serveUrl = path.join(process.cwd(), ".remotion-bundle")

/** A frame waits this long for its video, image or font. */
const FRAME_TIMEOUT_MS = 60_000

export const renderFrames = task({
  id: "render-frames",
  queue: looks,
  machine: "medium-1x",
  maxDuration: 240,
  retry: { maxAttempts: 1 }, // Claude asks again if it needs to
  run: async (payload: RenderFramesPayload): Promise<RenderFramesOutput> => {
    // Imported here, not at the top: slow to load, and only the render tasks need it.
    const { openBrowser, renderStill, selectComposition } = await import("@remotion/renderer")

    const inputProps = {
      doc: payload.doc,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      durationInFrames: payload.durationInFrames,
    }
    // Deployed, the puppeteer() extension installs Chrome and sets this; locally Remotion downloads its own.
    const chrome = process.env.PUPPETEER_EXECUTABLE_PATH ?? null
    const chromeMode = chrome ? "chrome-for-testing" : "headless-shell"
    // One browser for every frame, instead of one per still.
    const browser = await openBrowser("chrome", { browserExecutable: chrome, chromeMode })

    try {
      const composition = await selectComposition({ serveUrl, id: "Main", inputProps, puppeteerInstance: browser, chromeMode })
      const scale = Math.min(1, payload.size / Math.max(payload.width, payload.height))

      const frames: RenderFramesOutput["frames"] = []
      for (const frame of payload.frames) {
        try {
          const { buffer } = await renderStill({
            serveUrl,
            composition,
            inputProps,
            frame,
            imageFormat: "jpeg",
            jpegQuality: 72,
            scale,
            timeoutInMilliseconds: FRAME_TIMEOUT_MS,
            puppeteerInstance: browser,
            chromeMode,
          })
          frames.push({ frame, jpeg: buffer ? buffer.toString("base64") : null, error: buffer ? null : "No image came back." })
        } catch (error) {
          // One broken frame (a file that won't load, a code clip that throws) shouldn't hide the others.
          const message = error instanceof Error ? error.message : String(error)
          logger.warn("Frame failed", { frame, message })
          frames.push({ frame, jpeg: null, error: message.slice(0, 500) })
        }
      }
      logger.info("Rendered frames", { count: frames.length, width: composition.width, height: composition.height, scale })
      return { frames }
    } finally {
      await browser.close({ silent: true })
    }
  },
})
