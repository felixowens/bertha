import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,text-decoration-color,scale,box-shadow,opacity] duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        // The one solid white button per view.
        default: "bg-primary text-primary-foreground hover:bg-primary-glow",
        hero: "bg-primary text-primary-foreground hover:bg-primary-glow",
        // Bordered, quiet: most controls.
        outline: "border-border bg-card text-foreground hover:bg-raised hover:border-input aria-expanded:bg-raised",
        secondary: "bg-raised text-foreground hover:bg-input",
        ghost: "text-muted-foreground hover:bg-raised hover:text-foreground aria-expanded:bg-raised aria-expanded:text-foreground",
        destructive: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        link: "h-auto px-0 text-muted-foreground underline decoration-transparent underline-offset-4 hover:text-foreground hover:decoration-border",
      },
      size: {
        default: "h-8 px-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4",
        xl: "h-10 px-5 text-base",
        icon: "size-8",
        "icon-sm": "relative size-7 after:absolute after:-inset-1.5",
        "icon-xs": "relative size-6 rounded-sm after:absolute after:-inset-2",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-slot="button" data-variant={variant} className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
