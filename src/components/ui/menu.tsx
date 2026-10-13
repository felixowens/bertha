import type { ReactNode } from "react"
import { cn } from "cn"
import { Check } from "lucide-react"

/** Shared surfaces for menus, popovers and dialogs. */
export const menuContent =
  "z-50 min-w-44 rounded-xl border border-border bg-popover p-1 text-sm text-foreground shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
export const menuItem =
  "flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none select-none data-[highlighted]:bg-raised data-[highlighted]:text-foreground data-[disabled]:opacity-40"

export function CheckBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
        checked ? "border-foreground bg-foreground text-background" : "border-input bg-transparent",
        className,
      )}
    >
      {checked && <Check className="size-2.5" strokeWidth={3} />}
    </span>
  )
}

export function MenuHint({ children }: { children: ReactNode }) {
  return <span className="ml-auto font-mono text-2xs text-faint">{children}</span>
}
