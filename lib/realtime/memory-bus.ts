import "server-only"

import type { EventBus, Listener, ProjectEvent } from "@/lib/realtime/types"

/*
 * The local bus: channels in memory with the last 200 events kept for replay. It lives on
 * globalThis so it survives hot reloads. One server process only, which is all `next dev` is.
 */

const REPLAY = 200

type Channel = { next: number; events: { id: string; event: ProjectEvent }[]; listeners: Set<Listener> }

const store = globalThis as unknown as { __motionBus?: Map<string, Channel> }
const channels = (store.__motionBus ??= new Map<string, Channel>())

function channel(name: string) {
  let found = channels.get(name)
  if (!found) {
    found = { next: 1, events: [], listeners: new Set() }
    channels.set(name, found)
  }
  return found
}

export const memoryBus: EventBus = {
  async publish(name, event) {
    const ch = channel(name)
    const id = String(ch.next++)
    ch.events.push({ id, event })
    if (ch.events.length > REPLAY) ch.events.shift()
    for (const listener of ch.listeners) listener(id, event)
    return id
  },

  async subscribe(name, lastEventId, listener) {
    const ch = channel(name)
    if (lastEventId) {
      const after = Number(lastEventId)
      for (const { id, event } of ch.events) if (Number(id) > after) listener(id, event)
    }
    ch.listeners.add(listener)
    return () => {
      ch.listeners.delete(listener)
    }
  },
}
