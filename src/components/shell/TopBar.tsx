import type { ReactNode } from "react"
import { cn } from "cn"
import { Menu } from "lucide-react"
import { Link } from "@/lib/router"
import { StatusPill } from "@/components/ui/primitives"
import { useShell } from "./ShellContext"
import { useFrame } from "./AppFrame"
import { useLiveStatus } from "@/data/live"

export type Crumb = { label: string; to?: string }

/**
 * Context on the left (workspace, live status, breadcrumb), page controls on the right.
 */
export function TopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  const shell = useShell()
  const { openMenu: onMenu } = useFrame()
  const live = useLiveStatus()
  const lastEvent = shell.projects
    .map((p) => p.lastEventAt)
    .filter(Boolean)
    .sort()
    .at(-1)
  return (
    <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline bg-background/95 px-4 py-2.5 backdrop-blur md:px-6">
      <button onClick={onMenu} aria-label="Open navigation" className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-raised md:hidden">
        <Menu className="size-4" />
      </button>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="hidden items-center gap-2.5 sm:flex">
          <span className="grid h-6 min-w-6 place-items-center rounded-[5px] bg-foreground px-1 font-mono text-xs font-semibold text-background">
            {shell.projects.length}
          </span>
          <span className="text-sm text-foreground">{shell.viewer.role === "owner" ? "All projects" : "Your projects"}</span>
          {live === "open" ? (
            <StatusPill tone="ok" pulse={!!lastEvent}>
              Live
            </StatusPill>
          ) : (
            <StatusPill tone="quiet" className="text-faint">
              {live === "connecting" ? "Connecting" : "Offline"}
            </StatusPill>
          )}
        </span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2.5">
            <span className="hidden text-faint sm:inline" aria-hidden>
              /
            </span>
            {c.to ? (
              <Link to={c.to} className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className={cn("truncate text-sm text-foreground", i < crumbs.length - 1 && "text-muted-foreground")} aria-current="page">
                {c.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
