import { cn } from "cn"

import { Input } from "@/components/ui/input"

/** The design's solid, rounded field. Wraps shadcn's Input via className only. */
export function FilledInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        "h-12 rounded-2xl border-border bg-(--field) px-4 text-[15px] md:text-[15px] dark:bg-(--field)",
        className
      )}
      {...props}
    />
  )
}
