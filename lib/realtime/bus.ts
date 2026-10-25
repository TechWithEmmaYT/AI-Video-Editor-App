import "server-only"

import { memoryBus } from "@/lib/realtime/memory-bus"
import { redisBus } from "@/lib/realtime/redis-bus"
import type { EventBus } from "@/lib/realtime/types"

export type { ExportEvent, MediaEvent, OpsEvent, ProjectEvent } from "@/lib/realtime/types"

/*
 * Live updates (see the plan, §5.3). Locally (no REDIS_URL) events stay in this process's memory;
 * in production every server instance shares them through Redis.
 */
const bus: EventBus = process.env.REDIS_URL ? redisBus : memoryBus

/** Sends an event to everyone on the channel. Never throws: a failed publish is logged, not fatal (the save already happened). */
export async function publish(...args: Parameters<EventBus["publish"]>) {
  try {
    return await bus.publish(...args)
  } catch (error) {
    console.error("Couldn't publish a live update", error)
    return null
  }
}

export const subscribe = (...args: Parameters<EventBus["subscribe"]>) => bus.subscribe(...args)

export const projectChannel = (projectId: string) => `project:${projectId}`
