"use client"

import { NumberField } from "@base-ui/react/number-field"
import { useEffect, useRef } from "react"
import { cn } from "cn"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/*
 * Inspector building blocks, styled after the design's Style panel: filled rounded rows with the
 * label on the left and the value on the right. Values preview while they change (onPreview)
 * and save once settled (onCommit).
 */

const ROW = "flex h-11 items-center justify-between gap-3 rounded-xl bg-muted/60 px-3.5 text-[13px]"

export function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function FieldRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(ROW, className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/**
 * A number. Drag the label left/right to scrub, type a value, or use the arrow keys
 * (Shift = ×10). With `fill`, a bar behind the row shows where the value sits between min and max.
 */
export function NumberRow({
  label,
  value,
  onPreview,
  onCommit,
  min,
  max,
  step = 1,
  unit,
  decimals = 0,
  fill,
}: {
  label: string
  value: number
  onPreview: (value: number) => void
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  decimals?: number
  fill?: boolean
}) {
  const ratio = fill && min !== undefined && max !== undefined ? (value - min) / (max - min) : null

  return (
    <NumberField.Root
      value={value}
      min={min}
      max={max}
      step={step}
      largeStep={step * 10}
      format={{ maximumFractionDigits: decimals, useGrouping: false }}
      onValueChange={(next) => next !== null && onPreview(next)}
      onValueCommitted={(next) => next !== null && onCommit(next)}
      className={cn(ROW, "relative overflow-hidden")}
    >
      {ratio !== null && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/[0.07]"
          style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }}
        />
      )}
      <NumberField.ScrubArea className="relative flex h-full flex-1 cursor-ew-resize items-center text-muted-foreground select-none">
        {label}
      </NumberField.ScrubArea>
      <span className="relative flex items-center gap-1">
        <NumberField.Input
          aria-label={label}
          className="w-16 bg-transparent text-right font-medium tabular-nums outline-none focus:text-foreground"
        />
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
    </NumberField.Root>
  )
}

export function SelectRow<T extends string>({
  label,
  value,
  items,
  onChange,
  onOpenChange,
  renderItem,
}: {
  label: string
  value: T
  items: { value: T; label: string }[]
  onChange: (value: T) => void
  onOpenChange?: (open: boolean) => void
  renderItem?: (item: { value: T; label: string }) => React.ReactNode
}) {
  return (
    <FieldRow label={label}>
      <Select
        value={value}
        items={items}
        onValueChange={(next) => next !== null && onChange(next as T)}
        onOpenChange={(open) => onOpenChange?.(open)}
      >
        <SelectTrigger
          aria-label={label}
          className="-mr-1.5 h-8 max-w-[60%] border-0 bg-transparent px-1.5 font-medium shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {renderItem ? renderItem(item) : item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldRow>
  )
}

/** A small segmented control (fit, alignment). */
export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  onChange: (value: T) => void
}) {
  return (
    <FieldRow label={label}>
      <div role="radiogroup" aria-label={label} className="-mr-1.5 flex gap-0.5 rounded-lg bg-background/60 p-0.5">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.icon ? <option.icon className="size-3.5" /> : option.label}
            </button>
          )
        })}
      </div>
    </FieldRow>
  )
}

/** Colour swatch (opens the system picker) plus the hex value. */
export function ColorRow({
  label,
  value,
  onPreview,
  onCommit,
}: {
  label: string
  value: string
  onPreview: (value: string) => void
  onCommit: (value: string) => void
}) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"

  // React's onChange fires on every move in the picker; the native change event fires once it closes.
  useEffect(() => {
    const picker = pickerRef.current
    if (!picker) return
    const onClose = () => onCommit(picker.value)
    picker.addEventListener("change", onClose)
    return () => picker.removeEventListener("change", onClose)
  }, [onCommit])

  return (
    <FieldRow label={label}>
      <span className="flex items-center gap-2">
        <input
          key={value}
          aria-label={`${label} hex`}
          defaultValue={value}
          maxLength={9}
          spellCheck={false}
          onBlur={(event) => {
            const next = event.target.value.trim()
            if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(next)) onCommit(next)
            else event.target.value = value
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          className="w-20 bg-transparent text-right font-medium uppercase tabular-nums outline-none"
        />
        <label className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border" style={{ background: value }}>
          <input
            ref={pickerRef}
            type="color"
            aria-label={label}
            value={hex}
            onChange={(event) => onPreview(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </span>
    </FieldRow>
  )
}

/** A short text value (a clip name), saved on blur or Enter; Escape puts it back. */
export function TextRow({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  return (
    <FieldRow label={label}>
      <input
        key={value}
        aria-label={label}
        defaultValue={value}
        maxLength={200}
        onBlur={(event) => {
          const next = event.target.value.trim()
          if (next && next !== value) onCommit(next)
          else event.target.value = value
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            event.currentTarget.value = value
            event.currentTarget.blur()
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-right font-medium outline-none"
      />
    </FieldRow>
  )
}
