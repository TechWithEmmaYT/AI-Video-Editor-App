import type { ProjectFormat } from "@/types/project"

/**
 * A brief: one editing style written for Claude: when to use it, how the tracks are laid out,
 * the steps, and the exact numbers. get_guide lists them and returns one in full.
 */
export type Brief = {
  id: string
  name: string
  /** One line for the list. */
  summary: string
  /** Formats it's made for (it may still work in others). */
  formats: ProjectFormat[]
  /** Built-in elements it uses (checked by a test, so a renamed element can't break it silently). */
  elements: string[]
  /** MCP tools it relies on; some may not exist yet (see `available` in get_guide). */
  tools: string[]
  /** The brief itself, in Markdown. */
  body: string
}
