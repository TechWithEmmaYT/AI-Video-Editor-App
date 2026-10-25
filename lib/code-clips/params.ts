import type { ParamDef } from "@/lib/project/schema"

/*
 * Code clip parameters (`p`): each ParamDef's default, overridden by the clip's values, coerced to
 * the declared type. The result is frozen, so code can read `p` but never change it.
 */

function coerce(def: ParamDef, value: unknown): unknown {
  switch (def.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value)
      if (!Number.isFinite(n)) return def.default
      return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, n))
    }
    case "boolean":
      return Boolean(value)
    case "select":
      return def.options?.includes(String(value)) ? String(value) : def.default
    default:
      return value === null || value === undefined ? def.default : String(value)
  }
}

export function resolveParams(schema: ParamDef[], values: Record<string, unknown>): Readonly<Record<string, unknown>> {
  // Values without a definition pass through as they are (Claude may add one-off values).
  const resolved: Record<string, unknown> = { ...values }
  for (const def of schema) resolved[def.key] = coerce(def, def.key in values ? values[def.key] : def.default)
  return Object.freeze(resolved)
}

/** A schema's defaults, for a new clip. */
export function defaultParams(schema: ParamDef[]): Record<string, unknown> {
  return Object.fromEntries(schema.map((def) => [def.key, def.default]))
}
