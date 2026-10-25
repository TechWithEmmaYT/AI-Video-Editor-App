import { instrument } from "@/lib/code-clips/instrument"
import { BANNED_PROPERTIES, CodeValidationError, type CodeError } from "@/lib/code-clips/validate"

/*
 * Layer 3 (see the plan, §7): turn checked, instrumented code into a function, cached by its
 * source. The runtime guards live here: `__g`/`__s` refuse banned keys, `__tick` stops a
 * frame after 200k ticks or 50 ms.
 */

export const MAX_TICKS = 200_000
export const MAX_FRAME_MS = 50

export type DrawArgs = {
  ctx: CanvasRenderingContext2D
  t: number
  u: number
  w: number
  h: number
  p: Readonly<Record<string, unknown>>
  M: object
}

export type Compiled = { ok: true; draw: (args: DrawArgs) => void } | { ok: false; error: CodeError }

type CompiledFn = (...args: unknown[]) => void

function safeKey(key: unknown): string {
  if (typeof key === "symbol") throw new Error("Symbol keys aren't allowed")
  // Converted once, so an object whose toString changes between calls can't sneak a key past.
  const name = String(key)
  if (BANNED_PROPERTIES.has(name)) throw new Error(`"${name}" isn't allowed`)
  return name
}

/** a[b] */
function get(object: Record<string, unknown>, key: unknown) {
  const value = object[safeKey(key)]
  // Keep `this` for method calls like ctx[name](…).
  return typeof value === "function" ? value.bind(object) : value
}

/** a[b] = v, a[b] op= v, a[b]++ */
function set(object: Record<string, unknown>, key: unknown, value: unknown, op = "=", postfix = false) {
  const name = safeKey(key)
  if (op === "=") return (object[name] = value)
  const current = object[name] as number
  const v = value as number
  let next: unknown
  switch (op) {
    case "++": next = current + 1; break
    case "--": next = current - 1; break
    case "+=": next = current + v; break
    case "-=": next = current - v; break
    case "*=": next = current * v; break
    case "/=": next = current / v; break
    case "%=": next = current % v; break
    case "**=": next = current ** v; break
    case "<<=": next = current << v; break
    case ">>=": next = current >> v; break
    case ">>>=": next = current >>> v; break
    case "&=": next = current & v; break
    case "|=": next = current | v; break
    case "^=": next = current ^ v; break
    case "&&=": next = current && value; break
    case "||=": next = current || value; break
    case "??=": next = current ?? value; break
    default: throw new Error(`Unsupported operator ${op}`)
  }
  object[name] = next
  return postfix ? current : next
}

const cache = new Map<string, Compiled>()
const CACHE_LIMIT = 200

/** Compiles a code clip body. Never throws: problems come back as `{ ok: false, error }`. */
export function compileCode(code: string): Compiled {
  const hit = cache.get(code)
  if (hit) return hit

  let compiled: Compiled
  try {
    const source = instrument(code)
    // Same line as the code, so line numbers in errors still match what was written.
    const fn = new Function("ctx", "t", "u", "w", "h", "p", "M", "__g", "__s", "__tick", `"use strict";${source}`) as CompiledFn
    compiled = { ok: true, draw: (args) => runFrame(fn, args) }
  } catch (error) {
    compiled = {
      ok: false,
      error: error instanceof CodeValidationError ? error.error : { message: (error as Error).message, line: 1, column: 0 },
    }
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(code, compiled)
  return compiled
}

/** One frame, with a fresh tick budget. Errors (including the budget) propagate to the caller. */
function runFrame(fn: CompiledFn, { ctx, t, u, w, h, p, M }: DrawArgs) {
  let ticks = 0
  const started = performance.now()
  const tick = () => {
    ticks++
    if (ticks > MAX_TICKS) throw new Error(`Stopped: this frame ran more than ${MAX_TICKS.toLocaleString("en")} loop steps (an endless loop?)`)
    if ((ticks & 1023) === 0 && performance.now() - started > MAX_FRAME_MS) {
      throw new Error(`Stopped: this frame took more than ${MAX_FRAME_MS} ms`)
    }
  }
  fn(ctx, t, u, w, h, p, M, get, set, tick)
}
