import type { ReactNode } from "react"
import { Tooltip } from "radix-ui"

/** One provider for the app: after the first tip opens, the next opens at once. */
export const TipProvider = ({ children }: { children: ReactNode }) => (
  <Tooltip.Provider delayDuration={400} skipDelayDuration={300}>
    {children}
  </Tooltip.Provider>
)

/** A short label for an icon-only control. `off` renders the child alone (an expanded sidebar has its labels). */
export function Tip({ label, side = "top", children, off }: { label: ReactNode; side?: "top" | "right" | "bottom" | "left"; children: ReactNode; off?: boolean }) {
  if (off) return children
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          className="z-[70] origin-popper rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground shadow-pop duration-100 ease-smooth select-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-[0.96] data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
