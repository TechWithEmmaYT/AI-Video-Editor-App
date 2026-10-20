"use client"

import { useQuery } from "@tanstack/react-query"
import { BotIcon, SearchIcon, ShapesIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "cn"

import { ElementPreview } from "@/components/editor/panels/element-preview"
import { getElementsQueryFn, queryKeys } from "@/lib/api"
import { setElementDragData } from "@/lib/element-drag"
import { BUILTIN_ELEMENTS } from "@/lib/elements/builtin"
import { planElementAdd } from "@/lib/elements/place"
import { ELEMENT_CATEGORIES, type ElementCategory, type ElementDef } from "@/lib/elements/types"
import { useEditorStore } from "@/stores/editor-store"

type Filter = "all" | ElementCategory | "mine"

const FILTERS: { id: Filter; label: string }[] = [{ id: "all", label: "All" }, ...ELEMENT_CATEGORIES, { id: "mine", label: "Mine" }]

/** Elements tab: built-in and saved code clips. Click to add at the playhead, or drag onto the timeline. */
export function ElementsPanel() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [hovered, setHovered] = useState<string | null>(null)
  const { data: mine = [], isError } = useQuery({ queryKey: queryKeys.elements, queryFn: getElementsQueryFn })

  const pool = filter === "mine" ? mine : [...BUILTIN_ELEMENTS, ...mine]
  const search = query.trim().toLowerCase()
  const shown = pool.filter(
    (element) =>
      (filter === "all" || filter === "mine" || element.category === filter) &&
      (!search || element.name.toLowerCase().includes(search) || element.category.includes(search))
  )

  function add(element: ElementDef) {
    const { data, frame, fps, width, height, dispatch } = useEditorStore.getState()
    const result = planElementAdd(data, element, { frame, target: null, fps, width, height })
    dispatch(result.ops, { select: result.clipId })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-10 items-center gap-2 rounded-xl bg-muted/60 px-3 text-[13px] focus-within:ring-2 focus-within:ring-ring/40">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search elements"
          aria-label="Search elements"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-medium transition-colors",
              filter === item.id ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((element) => (
            <button
              key={element.id}
              type="button"
              draggable
              onDragStart={(event) => setElementDragData(event, element)}
              onClick={() => add(element)}
              onMouseEnter={() => setHovered(element.id)}
              onMouseLeave={() => setHovered((id) => (id === element.id ? null : id))}
              onFocus={() => setHovered(element.id)}
              onBlur={() => setHovered((id) => (id === element.id ? null : id))}
              title={`${element.name}: click to add at the playhead, or drag onto the timeline`}
              className="group flex cursor-grab flex-col gap-1.5 text-left outline-none active:cursor-grabbing"
            >
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-[#111114] ring-(--editor-accent) transition-shadow group-hover:ring-2 group-focus-visible:ring-2">
                <ElementPreview element={element} playing={hovered === element.id} />
                {element.createdBy === "claude" && (
                  <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    <BotIcon className="size-3" />
                    Claude
                  </span>
                )}
              </span>
              <span className="truncate text-[13px] font-medium">{element.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <ShapesIcon className="size-7 text-muted-foreground/70" />
          <p className="mt-3 text-sm font-semibold">{filter === "mine" ? "Nothing saved yet" : "No matches"}</p>
          <p className="mt-1 max-w-[230px] text-[13px] leading-relaxed text-muted-foreground">
            {filter === "mine"
              ? isError
                ? "Couldn't load your saved elements."
                : "Select a code clip and use Save as element in its Style tab. Claude can save them too."
              : "Try another word or category."}
          </p>
        </div>
      )}
    </div>
  )
}
