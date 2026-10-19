"use client"

import { Tabs } from "@base-ui/react/tabs"
import type { LucideIcon } from "lucide-react"

export type PanelTab<T extends string> = { value: T; label: string; icon: LucideIcon; content: React.ReactNode }

/** The left panel's segmented tabs, with a highlight that slides to the active tab. */
export function PanelTabs<T extends string>({
  tabs,
  value,
  onValueChange,
}: {
  tabs: PanelTab<T>[]
  value: T
  onValueChange: (value: T) => void
}) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onValueChange(next as T)} className="flex min-h-0 flex-1 flex-col">
      <Tabs.List className="relative mx-3 mt-3 flex shrink-0 gap-0.5 rounded-2xl bg-muted/70 p-1">
        {tabs.map(({ value: tab, label, icon: Icon }) => (
          <Tabs.Tab
            key={tab}
            value={tab}
            className="relative z-10 flex h-8 flex-auto items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-active:text-foreground"
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width) rounded-xl bg-(--pill-secondary) shadow-sm transition-[left,width] duration-200 ease-out" />
      </Tabs.List>

      {tabs.map(({ value: tab, content }) => (
        <Tabs.Panel key={tab} value={tab} className="min-h-0 flex-1 overflow-y-auto p-4 outline-none">
          {content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
