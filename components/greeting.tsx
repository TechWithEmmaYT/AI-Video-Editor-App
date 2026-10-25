"use client"

import { useSyncExternalStore } from "react"

function partOfDay(hour: number) {
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

const subscribe = () => () => {}

/** Uses the viewer's local clock, so it renders on the client only. */
export function Greeting({ name }: { name: string }) {
  const part = useSyncExternalStore(
    subscribe,
    () => partOfDay(new Date().getHours()),
    () => null
  )
  const firstName = name.split(" ")[0]

  return <span>{part ? `Good ${part}, ${firstName}.` : `Hi, ${firstName}.`}</span>
}
