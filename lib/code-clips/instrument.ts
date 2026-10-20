import MagicString from "magic-string"

import { check } from "@/lib/code-clips/validate"

/*
 * Layer 2 (see the plan, §7): rewrite validated code so the dangerous parts are checked at
 * runtime too.
 * - `a[b]` → `__g(a, b)`, and `a[b] = v` / `a[b] += v` / `a[b]++` → `__s(a, b, v, op)`. Both throw on a
 *   banned key, which closes `p['con' + 'structor']` that the static check can't see.
 * - `__tick()` at the top of every loop body and function body, which throws when one frame runs
 *   too long, so `while (true) {}` can't freeze the tab or the render.
 * Edits are made parent-first, so nested rewrites compose (`a[b[c]]` → `__g(a, __g(b, c))`).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = { type: string; start: number; end: number } & Record<string, any>

/** Validates, then instruments. Throws CodeValidationError for invalid code. */
export function instrument(code: string): string {
  const ast = check(code) as unknown as AnyNode
  const s = new MagicString(code)

  /** Index of `char` searched from `from` (forward) or back from `to`. */
  const find = (char: string, from: number, to: number, backward = false) => {
    const index = backward ? code.lastIndexOf(char, to - 1) : code.indexOf(char, from)
    if (index < from || index >= to) throw new Error(`instrument: expected "${char}"`)
    return index
  }
  const overwrite = (index: number, length: number, text: string) =>
    text ? s.overwrite(index, index + length, text, { contentOnly: true }) : s.remove(index, index + length)

  function tickBody(body: AnyNode) {
    if (body.type === "BlockStatement") s.appendLeft(body.start + 1, "__tick();")
    else {
      s.appendLeft(body.start, "{__tick();")
      s.appendRight(body.end, "}")
    }
  }

  /** `obj[key]` with its brackets turned into `, ` and `close`. */
  function rewriteBrackets(member: AnyNode, close: string) {
    overwrite(find("[", member.object.end, member.property.start), 1, ", ")
    overwrite(find("]", member.property.end, member.end, true), 1, close)
  }

  function walk(node: AnyNode | null | undefined): void {
    if (!node || typeof node.type !== "string") return

    switch (node.type) {
      case "MemberExpression":
        if (node.computed) {
          s.appendLeft(node.start, "__g(")
          rewriteBrackets(node, ")")
        }
        walk(node.object)
        if (node.computed) walk(node.property)
        return

      case "AssignmentExpression":
        if (node.left.type === "MemberExpression" && node.left.computed) {
          const left = node.left
          s.appendLeft(node.start, "__s(")
          rewriteBrackets(left, "")
          overwrite(find(node.operator, left.end, node.right.start), node.operator.length, ", ")
          s.appendLeft(node.end, node.operator === "=" ? ")" : `, "${node.operator}")`)
          walk(left.object)
          walk(left.property)
          walk(node.right)
          return
        }
        break

      case "UpdateExpression":
        if (node.argument.type === "MemberExpression" && node.argument.computed) {
          const target = node.argument
          s.appendLeft(node.start, "__s(")
          if (node.prefix) overwrite(node.start, 2, "")
          else overwrite(node.end - 2, 2, "")
          rewriteBrackets(target, `, 1, "${node.operator}", ${!node.prefix})`)
          walk(target.object)
          walk(target.property)
          return
        }
        break

      case "WhileStatement":
      case "DoWhileStatement":
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
        tickBody(node.body)
        break

      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if (node.body.type === "BlockStatement") s.appendLeft(node.body.start + 1, "__tick();")
        else {
          s.appendLeft(node.body.start, "(__tick(), ")
          s.appendRight(node.body.end, ")")
        }
        break
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "type") continue
      const value = node[key]
      if (Array.isArray(value)) value.forEach((child) => child && typeof child === "object" && walk(child))
      else if (value && typeof value === "object" && typeof value.type === "string") walk(value)
    }
  }

  walk(ast)
  return s.toString()
}
