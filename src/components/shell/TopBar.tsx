import type { ReactNode } from "react"
import { cn } from "cn"
import { ChevronDown, Menu } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { Link, navigate } from "@/lib/router"
import { Mono, Square, StatusPill } from "@/components/ui/primitives"
import { menuContent, menuItem } from "@/components/ui/menu"
import { healthRank, healthTone } from "@/lib/meaning"
import { useShell } from "./ShellContext"
import { useFrame } from "./AppFrame"
import { useLiveStatus } from "@/data/live"

/** `mono` for versions, ids and hosts. */
export type Crumb = { label: string; to?: string; mono?: boolean }

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
          <ProjectSwitcher />
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
              <Link to={c.to} className={cn("truncate text-sm text-muted-foreground transition-colors hover:text-foreground", c.mono && "font-mono")}>
                {c.label}
              </Link>
            ) : (
              <span className={cn("truncate text-sm text-foreground", i < crumbs.length - 1 && "text-muted-foreground", c.mono && "font-mono")} aria-current="page">
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

/** "6 All projects ▾": jump to any project's home. */
function ProjectSwitcher() {
  const shell = useShell()
  const projects = [...shell.projects].sort((a, b) => healthRank[a.health] - healthRank[b.health] || a.name.localeCompare(b.name))
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="-ml-1 flex items-center gap-2.5 rounded-md py-1 pr-1.5 pl-1 transition-colors hover:bg-raised aria-expanded:bg-raised">
          <span className="grid h-6 min-w-6 place-items-center rounded-[5px] bg-foreground px-1 font-mono text-xs font-semibold text-background">{shell.projects.length}</span>
          <span className="text-sm text-foreground">{shell.viewer.role === "owner" ? "All projects" : "Your projects"}</span>
          <ChevronDown className="size-3.5 text-faint" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={cn(menuContent, "max-h-[70vh] w-64 overflow-y-auto")}>
          {projects.map((p) => (
            <DropdownMenu.Item key={p.id} className={menuItem} onSelect={() => navigate(`/projects/${p.id}`)}>
              <Square tone={healthTone[p.health]} hollow={p.health === "awaiting_first_event"} />
              <span className="flex-1 truncate">{p.name}</span>
              <Mono className="text-xs text-faint">{p.key}</Mono>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
          <DropdownMenu.Item className={menuItem} onSelect={() => navigate("/projects")}>
            All projects
          </DropdownMenu.Item>
          {shell.viewer.role === "owner" && (
            <DropdownMenu.Item className={menuItem} onSelect={() => navigate("/projects/new")}>
              New project
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
