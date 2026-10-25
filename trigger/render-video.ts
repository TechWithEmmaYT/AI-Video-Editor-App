import { createReadStream } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { logger, metadata, queue, task } from "@trigger.dev/sdk"

import type { RenderVideoMetadata, RenderVideoOutput, RenderVideoPayload } from "@/lib/export/types"

/*
 * Export (see the plan, §9): renders the project's doc with the same <Main> composition the
 * editor's Player uses and uploads the MP4 to ImageKit. The editor watches the run live
 * (Trigger.dev Realtime: status + this run's metadata); when it ends, the app reads the output or
 * the error from the run and saves it. Media plays from the original files (orig-true), so the
 * render uses no video processing units.
 */

/** One render at a time per user (triggered with concurrencyKey = userId). */
const renders = queue({ name: "renders", concurrencyLimit: 1 })

/** Built by scripts/bundle-remotion.mjs and shipped with the task (additionalFiles in trigger.config.ts). */
const serveUrl = path.join(process.cwd(), ".remotion-bundle")

const PROGRESS_EVERY_MS = 1000
/** A frame waits this long for its video, image or font before the render fails. */
const FRAME_TIMEOUT_MS = 120_000

function setStep(value: RenderVideoMetadata) {
  if (value.step) metadata.set("step", value.step)
  if (value.progress !== undefined) metadata.set("progress", value.progress)
}

export const renderVideo = task({
  id: "render-video",
  queue: renders,
  machine: "medium-2x", // Chrome + encoding need a few CPUs and some memory
  maxDuration: 900,
  retry: { maxAttempts: 1 }, // a render that failed once (broken file, bad code) fails again; Retry starts a new export
  run: async (payload: RenderVideoPayload): Promise<RenderVideoOutput> => {
    // Imported here, not at the top: they're slow to load and only this task needs them.
    const { renderMedia, selectComposition } = await import("@remotion/renderer")
    const { default: ImageKit } = await import("@imagekit/nodejs")

    const output = path.join(tmpdir(), `${payload.exportId}.mp4`)
    try {
      const inputProps = {
        doc: payload.doc,
        width: payload.width,
        height: payload.height,
        fps: payload.fps,
        durationInFrames: payload.durationInFrames,
      }
      // Deployed, the puppeteer() extension installs Chrome and sets this; locally Remotion downloads its own.
      const chrome = process.env.PUPPETEER_EXECUTABLE_PATH ?? null
      const browser = { browserExecutable: chrome, chromeMode: chrome ? "chrome-for-testing" : "headless-shell" } as const

      setStep({ step: "rendering", progress: 0 })
      const composition = await selectComposition({ serveUrl, id: "Main", inputProps, ...browser })

      let lastReport = 0
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        codec: "h264",
        outputLocation: output,
        timeoutInMilliseconds: FRAME_TIMEOUT_MS,
        ...browser,
        onProgress: ({ progress }) => {
          if (Date.now() - lastReport < PROGRESS_EVERY_MS) return
          lastReport = Date.now()
          setStep({ progress })
        },
      })
      logger.info("Rendered", { frames: composition.durationInFrames, width: composition.width, height: composition.height })

      setStep({ step: "uploading", progress: 1 })
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
      if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY isn't set in the Trigger.dev environment.")
      const imagekit = new ImageKit({ privateKey, timeout: 10 * 60_000 })
      const uploaded = await imagekit.files.upload({
        file: createReadStream(output),
        fileName: `${fileSlug(payload.projectName)}.mp4`,
        folder: `/motion/${payload.userId}/${payload.projectId}/exports/`,
        useUniqueFileName: true,
      })
      if (!uploaded.url || !uploaded.fileId) throw new Error("ImageKit didn't return the uploaded file's URL.")

      // ik-attachment makes the link download the file instead of playing it in the browser tab.
      return { mp4Url: `${uploaded.url}?ik-attachment=true`, imagekitFileId: uploaded.fileId }
    } finally {
      await rm(output, { force: true })
    }
  },
})

/** "My Video!" → "my-video" (ImageKit adds a unique suffix). */
function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "video"
  )
}
