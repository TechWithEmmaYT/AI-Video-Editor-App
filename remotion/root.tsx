import { Composition } from "remotion"

import { EMPTY_DOC } from "@/lib/project/schema"
import { Main, type MainProps } from "@/remotion/main"

/** What the export render passes: the doc plus the project's size, rate and length. */
export type RenderProps = MainProps & { width: number; height: number; fps: number; durationInFrames: number }

/**
 * The composition the export renders (bundled by scripts/bundle-remotion.mjs). The editor's Player
 * uses <Main> directly; this wraps it so a render can take its size and length from the project.
 */
export function Root() {
  return (
    <Composition
      id="Main"
      component={Main as unknown as React.ComponentType<Record<string, unknown>>}
      defaultProps={{ doc: EMPTY_DOC, width: 1920, height: 1080, fps: 30, durationInFrames: 90 } satisfies RenderProps}
      calculateMetadata={({ props }) => {
        const { width, height, fps, durationInFrames } = props as RenderProps
        return { width, height, fps, durationInFrames: Math.max(1, durationInFrames) }
      }}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={90}
    />
  )
}
