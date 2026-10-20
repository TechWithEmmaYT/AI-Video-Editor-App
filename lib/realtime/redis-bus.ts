import "server-only"

import { createClient, type RedisClientType } from "redis"

import type { EventBus, Listener, ProjectEvent } from "@/lib/realtime/types"

/*
 * The production bus (REDIS_URL set; see the plan, §5.3), for several server instances:
 * - publish: XADD stream:{channel} (capped at ~200) for replay, then PUBLISH {channel} with the
 *   event and its stream id;
 * - subscribe: XRANGE after Last-Event-ID to replay, then one shared subscriber connection per
 *   instance, ref-counted per channel, fanning out to local listeners.
 */

const REPLAY = 200

type Clients = { pub: RedisClientType; sub: RedisClientType; ready: Promise<unknown> }

const store = globalThis as unknown as { __motionRedis?: Clients; __motionRedisListeners?: Map<string, Set<Listener>> }
const listeners = (store.__motionRedisListeners ??= new Map<string, Set<Listener>>())

function clients(): Clients {
  if (!store.__motionRedis) {
    const pub = createClient({ url: process.env.REDIS_URL }) as RedisClientType
    // A connection in subscribe mode can't run other commands, hence a second one.
    const sub = pub.duplicate() as RedisClientType
    pub.on("error", (error) => console.error("Redis (publish) error", error))
    sub.on("error", (error) => console.error("Redis (subscribe) error", error))
    store.__motionRedis = { pub, sub, ready: Promise.all([pub.connect(), sub.connect()]) }
  }
  return store.__motionRedis!
}

const streamKey = (channel: string) => `stream:${channel}`

export const redisBus: EventBus = {
  async publish(channel, event) {
    const { pub, ready } = clients()
    await ready
    const id = await pub.xAdd(streamKey(channel), "*", { e: JSON.stringify(event) }, { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: REPLAY } })
    await pub.publish(channel, JSON.stringify({ id, event }))
    return id
  },

  async subscribe(channel, lastEventId, listener) {
    const { pub, sub, ready } = clients()
    await ready

    if (lastEventId) {
      // "(" = exclusive: only events after the last one the client saw.
      const entries = await pub.xRange(streamKey(channel), `(${lastEventId}`, "+")
      for (const entry of entries ?? []) listener(entry.id, JSON.parse(String(entry.message.e)) as ProjectEvent)
    }

    let local = listeners.get(channel)
    if (!local) {
      local = new Set()
      listeners.set(channel, local)
      const fanOut = local
      await sub.subscribe(channel, (message) => {
        const { id, event } = JSON.parse(message) as { id: string; event: ProjectEvent }
        for (const l of fanOut) l(id, event)
      })
    }
    local.add(listener)

    return () => {
      const set = listeners.get(channel)
      if (!set) return
      set.delete(listener)
      if (set.size === 0) {
        listeners.delete(channel)
        void sub.unsubscribe(channel).catch(() => undefined)
      }
    }
  },
}
