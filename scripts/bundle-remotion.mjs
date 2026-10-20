import path from "node:path"

import { bundle } from "@remotion/bundler"

/*
 * Bundles the composition (remotion/index.ts) into .remotion-bundle/, which the render-video
 * Trigger.dev task renders from. Run it again after changing anything under remotion/ or what it
 * imports; `npm run trigger:dev` and `npm run trigger:deploy` run it first.
 */

const root = process.cwd()
const outDir = path.join(root, ".remotion-bundle")

const started = Date.now()
await bundle({
  entryPoint: path.join(root, "remotion/index.ts"),
  outDir,
  // The app's "@/…" imports point at the project root (tsconfig paths).
  webpackOverride: (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": root } },
  }),
  onProgress: (progress) => process.stdout.write(`\rBundling the composition… ${progress}%`),
})
console.log(`\nBundled into .remotion-bundle/ in ${((Date.now() - started) / 1000).toFixed(1)} s`)
