/** Only allow same-site relative paths as a post-auth redirect target. */
export function safeNext(value: string | string[] | undefined, fallback = "/app") {
  const next = Array.isArray(value) ? value[0] : value
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
