import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useCurrentScale, useVideoConfig } from "remotion"

import { compileCode } from "@/lib/code-clips/compile"
import { reportCodeError } from "@/lib/code-clips/errors"
import { createHelpers } from "@/lib/code-clips/helpers"
import { resolveParams } from "@/lib/code-clips/params"
import { loadFontFamily } from "@/lib/fonts"
import type { CodeClip } from "@/lib/project/schema"

/*
 * A code clip: a canvas the size of the clip box as it appears on screen (box × the Player's zoom ×
 * devicePixelRatio in the editor; exactly the box, ×1, in the export), redrawn every frame by the clip's checked, compiled code. Position, opacity and radius
 * come from the Layer around it; the code only draws. Errors draw a red box on the clip and are
 * reported to the Style tab; the rest of the video keeps playing.
 */

export function CodeClipView({ clip }: { clip: CodeClip }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendering = getRemotionEnvironment().isRendering
  // How big the Player is showing the video (0.46 at "fit" on a laptop, 1 in the export).
  const playerScale = useCurrentScale()
  const { width: w, height: h } = clip.transform

  const compiled = useMemo(() => compileCode(clip.code), [clip.code])
  const params = useMemo(() => resolveParams(clip.paramSchema, clip.params), [clip.paramSchema, clip.params])
  const fontsVersion = useFonts(clip.fonts, rendering)
  // Bumped when an image/SVG the code asked for finishes loading, to redraw with it.
  const [assetsVersion, setAssetsVersion] = useState(0)
  // Export frames held until those loads land (released after the redraw that uses them).
  const held = useRef<number[]>([])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Pixels per composition pixel: sharp at the size it's shown, without a full-size canvas per clip.
    const dpr = rendering ? 1 : Math.min(2, Math.max(0.1, playerScale * (window.devicePixelRatio || 1)))
    // Setting the size also resets the context, so nothing leaks between frames.
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (!compiled.ok) {
      const message = `Line ${compiled.error.line}: ${compiled.error.message}`
      drawError(ctx, w, h, message)
      reportCodeError(clip.id, message)
      return
    }

    const pending: Promise<unknown>[] = []
    const M = createHelpers((promise) => pending.push(promise))
    const u = clip.durationInFrames > 1 ? Math.min(1, frame / (clip.durationInFrames - 1)) : 1
    try {
      compiled.draw({ ctx, t: frame / fps, u, w, h, p: params, M })
      reportCodeError(clip.id, null)
    } catch (error) {
      canvas.width = canvas.width // reset whatever the code left behind
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const message = error instanceof Error ? error.message : String(error)
      drawError(ctx, w, h, message)
      reportCodeError(clip.id, message)
    }

    if (pending.length > 0) {
      if (rendering) held.current.push(delayRender("Loading an image for a code clip"))
      Promise.allSettled(pending).then(() => setAssetsVersion((v) => v + 1))
    } else if (held.current.length > 0) {
      held.current.forEach((handle) => continueRender(handle))
      held.current = []
    }
  }, [compiled, params, frame, fps, w, h, rendering, playerScale, clip.id, clip.durationInFrames, fontsVersion, assetsVersion])

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
}

/** Loads the fonts the code declares; returns a counter that changes when they're ready (to redraw). */
function useFonts(fonts: string[], rendering: boolean) {
  const key = fonts.join("|")
  const [version, setVersion] = useState(0)
  const [handle] = useState(() => (rendering && fonts.length > 0 ? delayRender("Loading code clip fonts") : null))
  const released = useRef(false)

  useEffect(() => {
    if (!key) return
    Promise.all(key.split("|").map(loadFontFamily)).then(() => {
      setVersion((v) => v + 1)
      if (handle !== null && !released.current) {
        released.current = true
        continueRender(handle)
      }
    })
  }, [key, handle])

  return version
}

function drawError(ctx: CanvasRenderingContext2D, w: number, h: number, message: string) {
  ctx.fillStyle = "rgba(220, 38, 38, 0.18)"
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "rgba(239, 68, 68, 0.9)"
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.01)
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)

  const size = Math.max(12, Math.min(28, w / 30))
  ctx.fillStyle = "#fecaca"
  ctx.font = `600 ${size}px Inter, sans-serif`
  ctx.textBaseline = "top"
  const pad = size
  let y = pad
  for (const line of wrap(ctx, `Code error: ${message}`, w - pad * 2)) {
    if (y + size > h - pad) break
    ctx.fillText(line, pad, y)
    y += size * 1.3
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}
