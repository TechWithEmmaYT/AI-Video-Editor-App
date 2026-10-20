import type { VideoExport } from "@/lib/export/types"
import type { Op } from "@/lib/project/ops"

/** A file was added to the project (by Claude): the Media tab refreshes. */
export type MediaEvent = { type: "media"; mediaId: string }

export type OpsEvent = {
  type: "ops"
  ops: Op[]
  /** The project's version after these ops. */
  version: number
  /** The editor tab that sent them ("claude" for Claude), so a tab can skip its own echo. */
  clientId: string
  source: "editor" | "claude"
}

/** An export started or moved on (rendering progress, uploading, done, failed). */
export type ExportEvent = { type: "export"; export: VideoExport }

export type ProjectEvent = OpsEvent | MediaEvent | ExportEvent

export type Listener = (id: string, event: ProjectEvent) => void

/** The plan's EventBus (§5.3): the same interface in memory (local) and on Redis (production). */
export interface EventBus {
  /** Sends an event to everyone on the channel. Resolves to its id. */
  publish(channel: string, event: ProjectEvent): Promise<string>
  /** Listens on a channel, first replaying events after `lastEventId`. Resolves to unsubscribe. */
  subscribe(channel: string, lastEventId: string | null, listener: Listener): Promise<() => void>
}
