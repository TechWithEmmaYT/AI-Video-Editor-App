import { parse, type Node } from "acorn"

/*
 * Layer 1 of checking code clips (see the plan, §7): a static allow-list over the AST.
 * Deny by default: only the node types below are accepted, every name must resolve to a
 * parameter, a local or a safe global, and the property names that lead back to `window`
 * are banned. Runs on the server for every write and in the browser before compiling.
 */

export const CODE_PARAMS = ["ctx", "t", "u", "w", "h", "p", "M"] as const
export const MAX_CODE_BYTES = 20_000

export const SAFE_GLOBALS = new Set([
  "Math", "Number", "String", "Boolean", "Array", "Object", "JSON", "Path2D",
  "isFinite", "isNaN", "parseFloat", "parseInt", "NaN", "Infinity", "undefined",
])

export const BANNED_PROPERTIES = new Set([
  "constructor", "__proto__", "prototype", "caller", "callee", "arguments",
  "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
  "canvas", "ownerDocument", "defaultView",
])

const NEW_ALLOWED = new Set(["Path2D", "Array", "Float32Array", "Uint8ClampedArray"])
const OBJECT_ALLOWED = new Set(["keys", "values", "entries", "assign", "freeze"])

const ALLOWED_NODES = new Set([
  "Program", "ExpressionStatement", "BlockStatement", "EmptyStatement",
  "VariableDeclaration", "VariableDeclarator", "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression",
  "ReturnStatement", "IfStatement", "ForStatement", "ForOfStatement", "ForInStatement", "WhileStatement", "DoWhileStatement",
  "BreakStatement", "ContinueStatement", "SwitchStatement", "SwitchCase", "ThrowStatement", "TryStatement", "CatchClause",
  "ConditionalExpression", "LogicalExpression", "BinaryExpression", "UnaryExpression", "UpdateExpression",
  "AssignmentExpression", "SequenceExpression", "CallExpression", "NewExpression", "MemberExpression", "ChainExpression",
  "Identifier", "Literal", "TemplateLiteral", "TemplateElement", "ArrayExpression", "ObjectExpression", "Property",
  "SpreadElement", "RestElement", "ArrayPattern", "ObjectPattern", "AssignmentPattern",
])

/** Why a node type is refused, for the ones people (and Claude) actually try. */
const REFUSED: Record<string, string> = {
  ThisExpression: "`this` isn't available; use the parameters (ctx, t, u, w, h, p, M)",
  ImportExpression: "import() isn't allowed",
  MetaProperty: "import.meta / new.target aren't allowed",
  WithStatement: "`with` isn't allowed",
  ClassDeclaration: "classes aren't allowed; use functions",
  ClassExpression: "classes aren't allowed; use functions",
  TaggedTemplateExpression: "tagged templates aren't allowed",
  LabeledStatement: "labels aren't allowed",
  AwaitExpression: "async/await isn't allowed: drawing is synchronous",
  YieldExpression: "generators aren't allowed",
  Super: "`super` isn't allowed",
}

export type CodeError = { message: string; line: number; column: number }

export class CodeValidationError extends Error {
  constructor(public readonly error: CodeError) {
    super(`${error.message} (line ${error.line}, column ${error.column})`)
  }
}

type AnyNode = Node & Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

type Scope = { names: Set<string>; parent: Scope | null; isFunction: boolean }

/** Checks a code clip's body. Returns null when it's fine, or the first problem with its position. */
export function validateCode(code: string): CodeError | null {
  try {
    check(code)
    return null
  } catch (error) {
    if (error instanceof CodeValidationError) return error.error
    throw error
  }
}

/** Parses and checks; throws CodeValidationError. Returns the AST for the instrumenter. */
export function check(code: string): AnyNode {
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    throw new CodeValidationError({ message: `Code is over ${MAX_CODE_BYTES / 1000} KB`, line: 1, column: 0 })
  }

  let ast: AnyNode
  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowReturnOutsideFunction: true,
      locations: true,
    }) as AnyNode
  } catch (error) {
    const { loc, message } = error as { loc?: { line: number; column: number }; message: string }
    throw new CodeValidationError({ message: message.replace(/ \(\d+:\d+\)$/, ""), line: loc?.line ?? 1, column: loc?.column ?? 0 })
  }

  const root: Scope = { names: new Set(CODE_PARAMS), parent: null, isFunction: true }
  hoist(ast.body, root, root)
  visit(ast, root)
  return ast
}

function fail(node: AnyNode, message: string): never {
  throw new CodeValidationError({ message, line: node.loc?.start.line ?? 1, column: node.loc?.start.column ?? 0 })
}

// ── Scopes ──────────────────────────────────────────────────────────────

/** Names bound by a pattern (`a`, `[a, b]`, `{ x, y: z }`, `...rest`, `a = 1`). */
function patternNames(pattern: AnyNode, out: string[] = []): string[] {
  switch (pattern.type) {
    case "Identifier":
      out.push(pattern.name)
      break
    case "ArrayPattern":
      pattern.elements.forEach((element: AnyNode | null) => element && patternNames(element, out))
      break
    case "ObjectPattern":
      pattern.properties.forEach((property: AnyNode) => patternNames(property.type === "RestElement" ? property : property.value, out))
      break
    case "RestElement":
      patternNames(pattern.argument, out)
      break
    case "AssignmentPattern":
      patternNames(pattern.left, out)
      break
  }
  return out
}

function declare(scope: Scope, name: string, node: AnyNode) {
  if (name.startsWith("__")) fail(node, `Names starting with "__" are reserved (${name})`)
  scope.names.add(name)
}

/**
 * Declarations a block makes visible before they run: let/const/function in `block`, and
 * `var`s (anywhere inside, except nested functions) in `fnScope`.
 */
function hoist(statements: AnyNode[], block: Scope, fnScope: Scope) {
  const isRoot = block.parent === null
  for (const statement of statements) {
    if (statement.type === "FunctionDeclaration") declare(block, statement.id.name, statement)
    if (statement.type === "VariableDeclaration" && statement.kind !== "var") {
      statement.declarations.forEach((d: AnyNode) =>
        patternNames(d.id).forEach((name) => {
          // let/const can't redeclare a parameter in the same scope.
          if (isRoot && (CODE_PARAMS as readonly string[]).includes(name)) {
            fail(d, `"${name}" is already a parameter; pick another name`)
          }
          declare(block, name, d)
        })
      )
    }
  }
  hoistVars(statements, fnScope)
}

function hoistVars(node: AnyNode | AnyNode[] | null, fnScope: Scope) {
  if (!node) return
  if (Array.isArray(node)) return node.forEach((child) => hoistVars(child, fnScope))
  if (typeof node.type !== "string") return
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") return
  if (node.type === "VariableDeclaration" && node.kind === "var") {
    node.declarations.forEach((d: AnyNode) => patternNames(d.id).forEach((name) => declare(fnScope, name, d)))
  }
  for (const key of Object.keys(node)) {
    if (key === "loc") continue
    const value = node[key]
    if (value && typeof value === "object") hoistVars(value, fnScope)
  }
}

function resolves(scope: Scope | null, name: string): boolean {
  for (let s = scope; s; s = s.parent) if (s.names.has(name)) return true
  return false
}

function nearestFunction(scope: Scope) {
  let s: Scope = scope
  while (!s.isFunction && s.parent) s = s.parent
  return s
}

/** A name that means the global (not shadowed by a local of the same name). */
function isGlobal(node: AnyNode, scope: Scope, name: string) {
  return node.type === "Identifier" && node.name === name && !resolves(scope, name)
}

// ── Walk ────────────────────────────────────────────────────────────────

function visit(node: AnyNode | null | undefined, scope: Scope): void {
  if (!node) return
  if (!ALLOWED_NODES.has(node.type)) fail(node, REFUSED[node.type] ?? `${node.type} isn't allowed`)

  switch (node.type) {
    case "Program":
      return node.body.forEach((child: AnyNode) => visit(child, scope))

    case "BlockStatement": {
      const block: Scope = { names: new Set(), parent: scope, isFunction: false }
      hoist(node.body, block, nearestFunction(scope))
      return node.body.forEach((child: AnyNode) => visit(child, block))
    }

    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return visitFunction(node, scope)

    case "VariableDeclaration":
      return node.declarations.forEach((d: AnyNode) => {
        visitPattern(d.id, scope)
        visit(d.init, scope)
      })

    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement": {
      // `for (let i …)` gets its own scope for the loop variable.
      const loop: Scope = { names: new Set(), parent: scope, isFunction: false }
      const head = node.type === "ForStatement" ? node.init : node.left
      if (head?.type === "VariableDeclaration") hoist([head], loop, nearestFunction(scope))
      if (node.type === "ForStatement") {
        visit(node.init, loop)
        visit(node.test, loop)
        visit(node.update, loop)
      } else {
        if (head?.type === "VariableDeclaration") visit(head, loop)
        else if (head?.type === "Identifier") visitAssignTarget(head, loop)
        else fail(head, "use a plain variable in for…in / for…of")
        visit(node.right, loop)
      }
      return visit(node.body, loop)
    }

    case "SwitchStatement": {
      visit(node.discriminant, scope)
      // All cases share one block scope.
      const block: Scope = { names: new Set(), parent: scope, isFunction: false }
      hoist(node.cases.flatMap((c: AnyNode) => c.consequent), block, nearestFunction(scope))
      return node.cases.forEach((c: AnyNode) => {
        visit(c.test, block)
        c.consequent.forEach((child: AnyNode) => visit(child, block))
      })
    }

    case "CatchClause": {
      const block: Scope = { names: new Set(), parent: scope, isFunction: false }
      if (node.param) patternNames(node.param).forEach((name) => declare(block, name, node.param))
      if (node.param) visitPattern(node.param, block)
      return visit(node.body, block)
    }

    case "BreakStatement":
    case "ContinueStatement":
      if (node.label) fail(node, "labels aren't allowed")
      return

    case "Identifier":
      if (node.name.startsWith("__")) fail(node, `Names starting with "__" are reserved (${node.name})`)
      if (!resolves(scope, node.name) && !SAFE_GLOBALS.has(node.name)) {
        fail(node, `"${node.name}" isn't available. Use the parameters (ctx, t, u, w, h, p, M), locals, or Math/Number/String/Array/Object/JSON/Path2D`)
      }
      return

    case "MemberExpression":
      return visitMember(node, scope)

    case "NewExpression":
      if (node.callee.type !== "Identifier" || !NEW_ALLOWED.has(node.callee.name) || resolves(scope, node.callee.name)) {
        fail(node, "`new` only works with Path2D, Array, Float32Array and Uint8ClampedArray")
      }
      return node.arguments.forEach((arg: AnyNode) => visit(arg, scope))

    case "AssignmentExpression":
      visitAssignTarget(node.left, scope)
      return visit(node.right, scope)

    case "UpdateExpression":
      return visitAssignTarget(node.argument, scope)

    case "UnaryExpression":
      if (node.operator === "delete" && node.argument.type === "MemberExpression" && node.argument.computed) {
        fail(node, "delete a[b] isn't allowed")
      }
      return visit(node.argument, scope)

    case "Property":
      if (node.kind !== "init") fail(node, "getters and setters aren't allowed")
      if (!node.computed) checkKey(node.key)
      else visit(node.key, scope)
      // `{ a }` shorthand reads `a`.
      return visit(node.value, scope)

    case "TemplateLiteral":
      return node.expressions.forEach((expression: AnyNode) => visit(expression, scope))

    case "Literal":
    case "TemplateElement":
    case "EmptyStatement":
      return

    default:
      // Every other allowed node: visit its child nodes.
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "type") continue
        const value = node[key]
        if (Array.isArray(value)) value.forEach((child) => child && typeof child.type === "string" && visit(child, scope))
        else if (value && typeof value === "object" && typeof value.type === "string") visit(value, scope)
      }
  }
}

function visitFunction(node: AnyNode, scope: Scope) {
  if (node.async) fail(node, "async functions aren't allowed: drawing is synchronous")
  if (node.generator) fail(node, "generators aren't allowed")

  const fn: Scope = { names: new Set(), parent: scope, isFunction: true }
  // A named function expression can call itself by name.
  if (node.type === "FunctionExpression" && node.id) declare(fn, node.id.name, node)
  node.params.forEach((param: AnyNode) => patternNames(param).forEach((name) => declare(fn, name, param)))
  node.params.forEach((param: AnyNode) => visitPattern(param, fn))

  if (node.body.type === "BlockStatement") {
    hoist(node.body.body, fn, fn)
    node.body.body.forEach((child: AnyNode) => visit(child, fn))
  } else {
    visit(node.body, fn)
  }
}

/** A binding pattern: check destructured property names and default values. */
function visitPattern(pattern: AnyNode, scope: Scope) {
  switch (pattern.type) {
    case "Identifier":
      if (pattern.name.startsWith("__")) fail(pattern, `Names starting with "__" are reserved (${pattern.name})`)
      return
    case "ArrayPattern":
      return pattern.elements.forEach((element: AnyNode | null) => element && visitPattern(element, scope))
    case "ObjectPattern":
      return pattern.properties.forEach((property: AnyNode) => {
        if (property.type === "RestElement") return visitPattern(property.argument, scope)
        // `const { constructor } = x` reads x.constructor; computed keys can't be checked.
        if (property.computed) fail(property, "computed keys in destructuring aren't allowed")
        checkKey(property.key)
        visitPattern(property.value, scope)
      })
    case "RestElement":
      return visitPattern(pattern.argument, scope)
    case "AssignmentPattern":
      visitPattern(pattern.left, scope)
      return visit(pattern.right, scope)
    default:
      fail(pattern, `${pattern.type} can't be used here`)
  }
}

/** The left side of `=`, `+=`, `++`, or a for-in/of head. */
function visitAssignTarget(target: AnyNode, scope: Scope) {
  if (target.type === "MemberExpression") return visitMember(target, scope)
  if (target.type === "Identifier") {
    // Assigning to an undeclared name would create a global.
    if (!resolves(scope, target.name)) fail(target, `"${target.name}" isn't declared; use let or const`)
    return visit(target, scope)
  }
  if (target.type === "ArrayPattern" || target.type === "ObjectPattern") {
    visitPattern(target, scope)
    patternNames(target).forEach((name) => {
      if (!resolves(scope, name)) fail(target, `"${name}" isn't declared; use let or const`)
    })
    return
  }
  fail(target, "can't assign to this")
}

function visitMember(node: AnyNode, scope: Scope) {
  if (node.computed) {
    if (node.optional) fail(node, "optional computed access (a?.[b]) isn't allowed; check for null first")
    if (isGlobal(node.object, scope, "Object")) fail(node, "Object[...] isn't allowed; use Object.keys/values/entries/assign/freeze")
    if (node.property.type === "Literal" && BANNED_PROPERTIES.has(String(node.property.value))) {
      fail(node.property, `"${node.property.value}" isn't allowed`)
    }
    visit(node.object, scope)
    return visit(node.property, scope)
  }
  checkKey(node.property)
  if (isGlobal(node.object, scope, "Object") && !OBJECT_ALLOWED.has(node.property.name)) {
    fail(node.property, `Object.${node.property.name} isn't allowed; use Object.keys/values/entries/assign/freeze`)
  }
  visit(node.object, scope)
}

function checkKey(key: AnyNode) {
  const name = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : null
  if (name !== null && BANNED_PROPERTIES.has(name)) fail(key, `"${name}" isn't allowed`)
}
