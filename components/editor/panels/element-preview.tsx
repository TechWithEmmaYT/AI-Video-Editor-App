"use client"

import { useEffect, useRef, useState } from "react"

import { compileCode } from "@/lib/code-clips/compile"
import { createHelpers } from "@/lib/code-clips/helpers"
import { defaultParams, resolveParams } from "@/lib/code-clips/params"
import { elementBox } from "@/lib/elements/place"
import type { ElementDef } from "@/lib/elements/types"
import { loadFontFamily } from "@/lib/fonts"
import { useEditorStore } from "@/stores/editor-store"

/**
 * An element drawn on a small canvas, at the size its box would have in this project, scaled to
 * fit. Still at u = 0.5; plays on a loop while `playing` (card hover).
 */
export function ElementPreview({ element, playing }: { element: ElementDef; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = useEditorStore((state) => state.width)
  const height = useEditorStore((state) => state.height)
  const fps = useEditorStore((state) => state.fps)
  // Bumped when fonts or images the element uses arrive, to redraw with them.
  const [loaded, setLoaded] = useState(0)

  const fontKey = element.fonts.join("|")
  useEffect(() => {
    if (!fontKey) return
    Promise.all(fontKey.split("|").map(loadFontFamily)).then(() => setLoaded((v) => v + 1))
  }, [fontKey])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const compiled = compileCode(element.code)
    const p = resolveParams(element.paramSchema, { ...defaultParams(element.paramSchema), ...element.defaultParams })
    const box = elementBox(element.layout, width, height)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(cw * dpr))
    canvas.height = Math.max(1, Math.round(ch * dpr))
    const scale = Math.min(cw / box.width, ch / box.height) * (element.layout === "full" ? 1 : 0.9)
    const seconds = element.defaultDurationInFrames / fps
    let waiting = false

    function draw(t: number) {
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      if (!compiled.ok) return
      ctx!.save()
      ctx!.setTransform(dpr * scale, 0, 0, dpr * scale, (dpr * (cw - box.width * scale)) / 2, (dpr * (ch - box.height * scale)) / 2)
      const pending: Promise<unknown>[] = []
      try {
        compiled.draw({ ctx: ctx!, t, u: Math.min(1, t / seconds), w: box.width, h: box.height, p, M: createHelpers((x) => pending.push(x)) })
      } catch {
        // A broken element just shows what it drew; the Style tab reports errors for real clips.
      }
      ctx!.restore()
      if (pending.length > 0 && !waiting) {
        waiting = true
        Promise.allSettled(pending).then(() => setLoaded((v) => v + 1))
      }
    }

    if (!playing) {
      draw(seconds * 0.5)
      return
    }
    const started = performance.now()
    let frame = requestAnimationFrame(function loop(now) {
      draw(((now - started) / 1000) % seconds)
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [element, playing, width, height, fps, loaded])

  return <canvas ref={canvasRef} className="size-full" aria-hidden />
}
