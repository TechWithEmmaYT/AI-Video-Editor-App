import { describe, expect, it } from "vitest"

import { memoryBus } from "@/lib/realtime/memory-bus"
import type { ProjectEvent } from "@/lib/realtime/types"

const event = (version: number): ProjectEvent => ({ type: "ops", ops: [], version, clientId: "c", source: "editor" })

describe("memory bus", () => {
  it("delivers to subscribers on the channel only, with increasing ids", async () => {
    const got: [string, number][] = []
    const off = await memoryBus.subscribe("test:a", null, (id, e) => got.push([id, e.type === "ops" ? e.version : 0]))
    const id1 = await memoryBus.publish("test:a", event(1))
    await memoryBus.publish("test:b", event(99))
    const id2 = await memoryBus.publish("test:a", event(2))
    expect(Number(id2)).toBeGreaterThan(Number(id1))
    expect(got).toEqual([[id1, 1], [id2, 2]])
    off()
    await memoryBus.publish("test:a", event(3))
    expect(got).toHaveLength(2)
  })

  it("replays events after Last-Event-ID to a reconnecting subscriber", async () => {
    const first = await memoryBus.publish("test:c", event(1))
    await memoryBus.publish("test:c", event(2))
    await memoryBus.publish("test:c", event(3))
    const versions: number[] = []
    const off = await memoryBus.subscribe("test:c", first, (_, e) => versions.push(e.type === "ops" ? e.version : 0))
    expect(versions).toEqual([2, 3])
    off()
  })
})
