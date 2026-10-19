import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/*
 * The design's chunky 3D pill button. Built straight on the Base UI primitive,
 * not on components/ui/button.tsx, so regenerating shadcn components can't change it.
 * Colours come from the --pill-* tokens in app/brand.css.
 */
const pillButtonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] outline-none transition-[translate,box-shadow,filter] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-b from-(--pill-primary-from) to-(--pill-primary-to) text-white shadow-[0_var(--pill-depth)_0_0_var(--pill-primary-edge),0_14px_30px_-12px_var(--pill-primary-glow)] hover:brightness-105 active:translate-y-(--pill-depth) active:shadow-[0_0_0_0_var(--pill-primary-edge)]",
        secondary:
          "bg-(--pill-secondary) text-(--pill-secondary-foreground) shadow-[0_var(--pill-depth)_0_0_var(--pill-secondary-edge)] hover:brightness-110 active:translate-y-(--pill-depth) active:shadow-[0_0_0_0_var(--pill-secondary-edge)]",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
      },
      size: {
        sm: "h-9 px-4 text-sm [--pill-depth:3px]",
        md: "h-11 px-6 text-[15px] [--pill-depth:4px]",
        lg: "h-14 px-8 text-[17px] [--pill-depth:5px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type PillButtonProps = ButtonPrimitive.Props & VariantProps<typeof pillButtonVariants>

function PillButton({ className, variant, size, ...props }: PillButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="pill-button"
      className={cn(pillButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { PillButton, pillButtonVariants }
