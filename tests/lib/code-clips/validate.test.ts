import { describe, expect, it } from "vitest"

import { compileCode } from "@/lib/code-clips/compile"
import { instrument } from "@/lib/code-clips/instrument"
import { changedCodeError } from "@/lib/code-clips/doc-check"
import { validateCode } from "@/lib/code-clips/validate"
import { CLIP_MOTION_DEFAULTS } from "@/lib/project/schema"

/** Runs code against a fake context and returns what it threw (or null). */
function run(code: string, p: Record<string, unknown> = {}) {
  const compiled = compileCode(code)
  if (!compiled.ok) throw new Error(`didn't compile: ${compiled.error.message}`)
  const calls: unknown[][] = []
  const ctx = new Proxy({ canvas: { secret: true } }, {
    get: (target, key) => (key in target ? target[key as "canvas"] : (...args: unknown[]) => calls.push([key, ...args])),
  }) as unknown as CanvasRenderingContext2D
  try {
    compiled.draw({ ctx, t: 1, u: 0.5, w: 100, h: 50, p: Object.freeze({ ...p }), M: Object.freeze(Object.create(null)) })
    return { error: null, calls }
  } catch (error) {
    return { error: (error as Error).message, calls }
  }
}

describe("validator: accepts drawing code", () => {
  it.each([
    "ctx.fillStyle = p.color; ctx.fillRect(0, 0, w * u, h)",
    "const pts = []; for (let i = 0; i < 10; i++) pts.push([i, Math.sin(i + t)]); for (const [x, y] of pts) ctx.lineTo(x, y)",
    "function ease(k) { return k * k } const k = ease(u); ctx.globalAlpha = k",
    "const words = String(p.text).split(' '); words.forEach((word, i) => { ctx.fillText(word, i * 10, h / 2) })",
    "let a = [1, 2]; a[0] = 3; a[1] += 2; a[0]++; ctx.fillRect(a[0], a[1], 1, 1)",
    "const { x = 1, y } = { y: 2 }; const path = new Path2D(); path.rect(x, y, 1, 1); ctx.fill(path)",
    "switch (p.mode) { case 'a': { let z = 1; ctx.rotate(z); break } default: ctx.rotate(0) }",
    "const o = Object.assign({}, p); Object.keys(o).forEach((k) => ctx.fillText(k, 0, 0))",
    "try { ctx.fill() } catch (e) { ctx.fillText(e.message, 0, 0) }",
    "return",
  ])("%s", (code) => {
    expect(validateCode(code)).toBeNull()
  })
})

describe("validator: rejects escape attempts", () => {
  it.each([
    ["window.alert(1)", "window"],
    ["document.cookie", "document"],
    ["globalThis.fetch('x')", "globalThis"],
    ["fetch('https://example.com')", "fetch"],
    ["eval('1')", "eval"],
    ["Function('return this')()", "Function"],
    ["this.x = 1", "this"],
    ["import('x')", "import()"],
    ["ctx.canvas.width", "canvas"],
    ["ctx.canvas.ownerDocument", "isn't allowed"],
    ["(() => 0).constructor('return window')()", "constructor"],
    ["p.__proto__.x = 1", "__proto__"],
    ["p['constructor']", "constructor"],
    ["async function f() {}", "async"],
    ["function* g() {}", "generators"],
    ["class A {}", "classes"],
    ["new Function('x')", "new"],
    ["Object.getPrototypeOf(p)", "Object.getPrototypeOf"],
    ["Object['getPrototypeOf'](p)", "Object[...]"],
    ["const { constructor: C } = p", "constructor"],
    ["x = 1", "isn't declared"],
    ["setTimeout(() => {}, 1)", "setTimeout"],
    ["localStorage.getItem('k')", "localStorage"],
    ["const __g = 1", "reserved"],
    ["label: for (;;) {}", "labels"],
    ["({ get x() { return 1 } })", "getters"],
    ["String.raw`x`", "tagged"],
    ["let w = 1", "already a parameter"],
    ["function f(window) {} window.x", "window"],
    ["x".repeat(20_001), "KB"],
  ])("%s", (code, expected) => {
    const error = validateCode(code)
    expect(error).not.toBeNull()
    expect(error!.message).toContain(expected)
    expect(error!.line).toBeGreaterThan(0)
  })

  it("reports the line and column", () => {
    expect(validateCode("ctx.fillRect(0, 0, 1, 1)\nwindow.x")).toMatchObject({ line: 2, column: 0 })
  })
})

describe("instrumenter + runtime guards", () => {
  it("rewrites computed access and injects ticks", () => {
    const out = instrument("for (;;) { p[p.b] = p[1] } const f = (x) => x[p[0]]").replace(/\s+/g, "")
    expect(out).toContain("__s(p,p.b,__g(p,1))")
    expect(out).toContain("{__tick();")
    expect(out).toContain("(__tick(),__g(x,__g(p,0)))")
  })

  it("blocks computed access to banned keys at runtime", () => {
    expect(run("const k = 'con' + 'structor'; ctx.fillText(String(p[k]), 0, 0)").error).toContain('"constructor" isn\'t allowed')
    expect(run("const k = ['can', 'vas'].join(''); ctx[k]").error).toContain('"canvas" isn\'t allowed')
    expect(run("const o = {}; o['__pro' + 'to__'] = 1").error).toContain("__proto__")
  })

  it("stops an endless loop", () => {
    expect(run("while (true) {}").error).toContain("Stopped")
    expect(run("for (;;) ctx.fill()").error).toContain("Stopped")
  })

  it("keeps normal semantics for computed writes", () => {
    const { error, calls } = run("const a = [5, 1]; a[0] += 2; a[1]++; const b = a[1]++; ctx.fillRect(a[0], a[1], b, ++a[0])")
    expect(error).toBeNull()
    expect(calls).toContainEqual(["fillRect", 7, 3, 2, 8])
  })

  it("passes params through and binds methods on computed calls", () => {
    const { error, calls } = run("ctx['fillText'](p.text, w, h)", { text: "hi" })
    expect(error).toBeNull()
    expect(calls).toContainEqual(["fillText", "hi", 100, 50])
  })

  it("returns validation errors instead of throwing", () => {
    expect(compileCode("window.x")).toMatchObject({ ok: false, error: { line: 1 } })
  })
})

describe("changedCodeError", () => {
  const base = { tracks: [{ id: "t1" }], sections: [], clips: [] }
  const codeClip = (code: string) => ({
    id: "c1", trackId: "t1", type: "code" as const, name: "Clip", color: "code", from: 0, durationInFrames: 30,
    transform: { x: 0, y: 0, width: 10, height: 10, scale: 1, rotation: 0, opacity: 1 },
    code, params: {}, paramSchema: [], fonts: [], radius: 0, ...CLIP_MOTION_DEFAULTS,
  })

  it("rejects new or edited code that fails the validator, with its line", () => {
    expect(changedCodeError(base, { ...base, clips: [codeClip("ctx.fill()\nwindow.x")] })).toMatch(/line 2.*window/)
    expect(changedCodeError({ ...base, clips: [codeClip("ctx.fill()")] }, { ...base, clips: [codeClip("fetch('x')")] })).toContain("fetch")
  })

  it("accepts valid code and leaves unchanged code alone", () => {
    expect(changedCodeError(base, { ...base, clips: [codeClip("ctx.fill()")] })).toBeNull()
  })
})
