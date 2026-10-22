import { useEffect, useRef, useState } from "react"
import { cn } from "cn"
import { Activity, Bell, ChevronDown, FolderOpen, EllipsisVertical, LayoutGrid, PanelLeft, Plus, Rocket, Inbox, Users, Bot, ScrollText } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import type { Monitor } from "../../contract/domain"
import { backend, signOut } from "@/data/backend"
import { Link, useLocation } from "@/lib/router"
import { since } from "@/lib/format"
import { healthRank, healthTone, monitorLabel, monitorTone } from "@/lib/meaning"
import { Avatar, FramedSquare, Mono, Square, type Tone } from "@/components/ui/primitives"
import { Ribbon } from "@/components/charts/cells"
import { isOwner, useShell } from "./ShellContext"
import { Wordmark } from "./Wordmark"
import { viewHref } from "@/components/issues/filters"
import { menuContent, menuItem } from "@/components/ui/menu"
import { Collapse, Indicator, motionOk, Tick } from "@/components/ui/motion"
import { Tip } from "@/components/ui/tip"

const VIEW_TONE: Record<string, Tone> = { "v-mine": "quiet", "v-new": "warn", "v-clients-fatal": "danger" }

export function Sidebar({ collapsed, onCollapse, onNavigate }: { collapsed: boolean; onCollapse: () => void; onNavigate?: () => void }) {
  const shell = useShell()
  const { path, query } = useLocation()
  const [monitors, setMonitors] = useState<Monitor[] | null>(null)
  // The shell reloads on every live event, so this follows monitors going down and up.
  useEffect(() => {
    backend.listMonitors().then(
      (m) => setMonitors(m.monitors),
      () => setMonitors(null),
    )
  }, [shell.counts])

  const nav = [
    { to: "/", label: "Overview", icon: LayoutGrid, active: path === "/" },
    { to: "/projects", label: "Projects", icon: FolderOpen, active: path === "/projects" },
    { to: "/issues", label: "Issues", icon: Inbox, active: path.startsWith("/issues") && !query.get("view"), count: shell.counts.unresolved },
    { to: "/releases", label: "Releases", icon: Rocket, active: path.startsWith("/releases") },
    {
      to: "/uptime",
      label: "Uptime",
      icon: Activity,
      active: path.startsWith("/uptime"),
      count: shell.counts.monitorsDown || undefined,
      alarm: shell.counts.monitorsDown > 0,
    },
    { to: "/logs", label: "Logs", icon: ScrollText, active: path === "/logs" || /^\/projects\/[^/]+\/logs$/.test(path) },
  ]
  const settings = [
    ...(isOwner(shell)
      ? [
          { to: "/settings/alerts", label: "Alerts", icon: Bell, active: path === "/settings/alerts" },
          { to: "/settings/team", label: "Team", icon: Users, active: path === "/settings/team" },
        ]
      : []),
    { to: "/settings/agents", label: "Agents", icon: Bot, active: path === "/settings/agents" },
  ]

  const down = monitors?.filter((m) => m.state === "down") ?? []
  const degraded = monitors?.filter((m) => m.state === "degraded") ?? []
  const projects = [...shell.projects].sort((a, b) => healthRank[a.health] - healthRank[b.health] || a.name.localeCompare(b.name))
  // Collapsing swaps the layout; a quick fade hides the jump.
  const navRef = useRef<HTMLElement>(null)
  const wasCollapsed = useRef(collapsed)
  useEffect(() => {
    if (wasCollapsed.current === collapsed) return
    wasCollapsed.current = collapsed
    if (motionOk()) navRef.current?.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" })
  }, [collapsed])

  const projectId = path.match(/^\/projects\/([^/]+)/)?.[1] ?? (path === "/issues" || path === "/releases" || path === "/uptime" || path === "/logs" ? query.get("project") : null)

  return (
    <nav ref={navRef} aria-label="Main" className="flex h-full flex-col gap-6 pt-5 pb-3" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <div className={cn("mx-3 flex shrink-0 items-center justify-between px-2", collapsed && "flex-col gap-4 px-0")}>
        <span className="flex items-center gap-2">
          <Link to="/" aria-label="bertha, overview" title={collapsed ? `bertha ${__BERTHA_VERSION__}` : undefined}>
            <Wordmark collapsed={collapsed} />
          </Link>
          {!collapsed && (
            <a
              href={`https://github.com/felixowens/bertha/releases/tag/v${__BERTHA_VERSION__}`}
              target="_blank"
              rel="noreferrer"
              title={`What's new in bertha ${__BERTHA_VERSION__}`}
              className="pt-0.5 text-faint transition-colors duration-150 ease-smooth hover:text-foreground"
            >
              <Mono className="text-2xs">{__BERTHA_VERSION__}</Mono>
            </a>
          )}
        </span>
        <Tip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side={collapsed ? "right" : "bottom"}>
          <button
            onClick={onCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="press hidden rounded-md p-1 text-faint hover:bg-raised hover:text-foreground md:block"
          >
            <PanelLeft className="size-4" />
          </button>
        </Tip>
      </div>

      {/* Only the middle scrolls, so a long project list never scrolls the page. */}
      <div className="relative -my-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-3 py-1 [scrollbar-width:thin]">
        {/* The current page's highlight slides between nav items. */}
        <Indicator selector='[data-nav][aria-current="page"]' watch={`${path}?${query}|${collapsed}`} className="rounded-md bg-raised" />
        <ul className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <NavItem key={n.to} {...n} collapsed={collapsed} />
          ))}
        </ul>

        {!collapsed && projects.length > 0 && (
          <Group label="Projects">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  aria-current={projectId === p.id ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-raised hover:text-foreground",
                    projectId === p.id && "bg-raised text-foreground",
                  )}
                >
                  <Square tone={healthTone[p.health]} hollow={p.health === "awaiting_first_event"} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.unresolvedIssues > 0 && (
                    <Mono className="text-xs text-faint">
                      <Tick value={p.unresolvedIssues} />
                    </Mono>
                  )}
                </Link>
              </li>
            ))}
            {isOwner(shell) && (
              <li>
                <Link
                  to="/projects/new"
                  aria-current={path === "/projects/new" ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-faint transition-colors hover:bg-raised hover:text-foreground",
                    path === "/projects/new" && "bg-raised text-foreground",
                  )}
                >
                  <Plus className="size-3.5" /> New project
                </Link>
              </li>
            )}
          </Group>
        )}

        {!collapsed && shell.savedViews.length > 0 && (
          <Group label="Saved views">
            {shell.savedViews.map((v) => (
              <li key={v.id}>
                <Link
                  to={viewHref(v)}
                  aria-current={query.get("view") === v.id ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-raised hover:text-foreground",
                    query.get("view") === v.id && "bg-raised text-foreground",
                  )}
                >
                  <FramedSquare tone={VIEW_TONE[v.id] ?? "quiet"} />
                  <span className="flex-1 truncate">{v.name}</span>
                  <Mono className="text-xs text-faint">
                    <Tick value={v.count} />
                  </Mono>
                </Link>
              </li>
            ))}
          </Group>
        )}

        {settings.length > 0 && (
          <Group label="Settings" collapsed={collapsed}>
            {settings.map((n) => (
              <NavItem key={n.to} {...n} collapsed={collapsed} />
            ))}
            {collapsed && <NavItem to="/projects/new" label="New project" icon={Plus} active={path === "/projects/new"} collapsed={collapsed} />}
          </Group>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 px-3">
        {!collapsed && monitors && monitors.length > 0 && (
          <Link
            to={down[0] ? `/uptime/${down[0].id}` : degraded[0] ? `/uptime/${degraded[0].id}` : "/uptime"}
            className="group rounded-lg border border-hairline bg-background p-3.5 transition-colors hover:border-border"
          >
            <div className="flex items-center justify-between text-2xs font-medium tracking-[0.08em] text-faint uppercase">
              Uptime
              <Mono className="tracking-normal normal-case">{monitors.length} monitors</Mono>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              {down.length ? (
                <>
                  <Mono className="text-lg text-danger">
                    <Tick value={down.length} /> down
                  </Mono>
                  <span className="truncate text-xs text-muted-foreground">for {since(down[0].since)}</span>
                </>
              ) : degraded.length ? (
                <>
                  <Mono className="text-lg text-warn">
                    <Tick value={degraded.length} /> degraded
                  </Mono>
                  <span className="truncate text-xs text-muted-foreground">for {since(degraded[0].since)}</span>
                </>
              ) : (
                <Mono className="animate-appear text-lg text-ok">All up</Mono>
              )}
            </div>
            <Ribbon
              className="mt-2.5"
              cellClass="h-2 flex-1"
              states={monitors.map((m) => monitorTone[m.state])}
              label={monitors.map((m) => `${m.name}: ${monitorLabel[m.state].toLowerCase()}`).join(", ")}
              titles={monitors.map((m) => `${m.name}: ${monitorLabel[m.state].toLowerCase()}`)}
            />
            {(down[0] ?? degraded[0]) && <div className="mt-2.5 truncate text-xs text-muted-foreground">{(down[0] ?? degraded[0]).name}</div>}
          </Link>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className={cn("flex items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-raised aria-expanded:bg-raised", collapsed && "justify-center")}>
              <span className="relative">
                <Avatar name={shell.viewer.name} className="size-8" />
                <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-[1px] border border-sidebar bg-ok" aria-hidden />
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{shell.viewer.name}</span>
                    <span className="block truncate text-xs text-faint">{shell.viewer.role === "owner" ? "Owner" : "Collaborator"}</span>
                  </span>
                  <EllipsisVertical className="size-4 text-faint" />
                </>
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" align="start" sideOffset={6} className={cn(menuContent, "w-56")}>
              <div className="px-2 py-1.5 text-xs text-faint">{shell.viewer.email}</div>
              <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
              <DropdownMenu.Item className={menuItem} onSelect={() => void signOut()}>
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  )
}

function Group({ label, children, collapsed }: { label: string; children: React.ReactNode; collapsed?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      {!collapsed && (
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="mb-1 flex items-center gap-1 px-2 text-xs text-faint transition-colors hover:text-muted-foreground">
          {label}
          <ChevronDown className={cn("size-3 transition-[rotate] duration-200 ease-smooth", !open && "-rotate-90")} />
        </button>
      )}
      <Collapse open={open}>
        <ul className="flex flex-col gap-0.5">{children}</ul>
      </Collapse>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  count,
  alarm,
  collapsed,
}: {
  to: string
  label: string
  icon: typeof LayoutGrid
  active: boolean
  count?: number
  alarm?: boolean
  collapsed: boolean
}) {
  return (
    <li>
      <Tip label={label} side="right" off={!collapsed}>
        <Link
          to={to}
          data-nav
          aria-current={active ? "page" : undefined}
          aria-label={collapsed ? label : undefined}
          className={cn(
            "relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150",
            active ? "text-foreground" : "text-muted-foreground hover:bg-raised/60 hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="flex-1">{label}</span>}
          {!collapsed && count !== undefined && (
            <Mono className={cn("text-xs transition-colors duration-150", alarm ? "text-danger" : "text-faint")}>
              <Tick value={count} />
            </Mono>
          )}
        </Link>
      </Tip>
    </li>
  )
}
