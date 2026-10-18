import { useEffect, useState } from "react"
import { cn } from "cn"
import {
  Activity,
  Bell,
  ChevronDown,
  EllipsisVertical,
  LayoutGrid,
  PanelLeft,
  Plus,
  Rocket,
  Inbox,
  Users,
} from "lucide-react"
import { DropdownMenu } from "radix-ui"
import type { Monitor } from "../../contract/domain"
import { backend, signOut } from "@/data/backend"
import { Link, useLocation } from "@/lib/router"
import { since } from "@/lib/format"
import { monitorTone } from "@/lib/meaning"
import { Avatar, FramedSquare, Mono, type Tone } from "@/components/ui/primitives"
import { Ribbon } from "@/components/charts/cells"
import { isOwner, useShell } from "./ShellContext"
import { Wordmark } from "./Wordmark"
import { viewHref } from "@/components/issues/filters"
import { menuContent, menuItem } from "@/components/ui/menu"

const VIEW_TONE: Record<string, Tone> = { "v-mine": "info", "v-new": "warn", "v-clients-fatal": "danger" }

export function Sidebar({ collapsed, onCollapse, onNavigate }: { collapsed: boolean; onCollapse: () => void; onNavigate?: () => void }) {
  const shell = useShell()
  const { path, query } = useLocation()
  const [monitors, setMonitors] = useState<Monitor[] | null>(null)
  useEffect(() => {
    backend.listMonitors().then((m) => setMonitors(m.monitors), () => setMonitors(null))
  }, [])

  const nav = [
    { to: "/", label: "Overview", icon: LayoutGrid, active: path === "/" },
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
  ]
  const settings = [
    ...(isOwner(shell)
      ? [
          { to: "/settings/alerts", label: "Alerts", icon: Bell, active: path === "/settings/alerts" },
          { to: "/settings/team", label: "Team", icon: Users, active: path === "/settings/team" },
        ]
      : []),
  ]

  const down = monitors?.filter((m) => m.state === "down") ?? []

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-6 px-3 pt-5 pb-3" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <div className={cn("flex items-center justify-between px-2", collapsed && "flex-col gap-4 px-0")}>
        <span className="flex items-center gap-2">
          <Link to="/" aria-label="bertha, overview" title={collapsed ? `bertha ${__BERTHA_VERSION__}` : undefined}>
            <Wordmark collapsed={collapsed} />
          </Link>
          {!collapsed && (
            <Mono className="pt-0.5 text-2xs text-faint" title={`bertha ${__BERTHA_VERSION__}`}>
              {__BERTHA_VERSION__}
            </Mono>
          )}
        </span>
        <button
          onClick={onCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-md p-1 text-faint transition-colors hover:bg-raised hover:text-foreground md:block"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <ul className="flex flex-col gap-0.5">
        {nav.map((n) => (
          <NavItem key={n.to} {...n} collapsed={collapsed} />
        ))}
      </ul>

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
                <Mono className="text-xs text-faint">{v.count}</Mono>
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
          <NavItem to="/projects/new" label="New project" icon={Plus} active={path === "/projects/new"} collapsed={collapsed} />
        </Group>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {!collapsed && monitors && monitors.length > 0 && (
          <Link
            to={down[0] ? `/uptime/${down[0].id}` : "/uptime"}
            className="group rounded-lg border border-hairline bg-background p-3.5 transition-colors hover:border-border"
          >
            <div className="flex items-center justify-between text-2xs font-medium tracking-[0.08em] text-faint uppercase">
              Uptime
              <Mono className="tracking-normal normal-case">{monitors.length} monitors</Mono>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              {down.length ? (
                <>
                  <Mono className="text-lg text-danger">{down.length} down</Mono>
                  <span className="truncate text-xs text-muted-foreground">for {since(down[0].since)}</span>
                </>
              ) : (
                <>
                  <Mono className="text-lg text-foreground">All up</Mono>
                </>
              )}
            </div>
            <Ribbon
              className="mt-2.5"
              cellClass="h-2 flex-1"
              states={monitors.map((m) => monitorTone[m.state])}
              label={monitors.map((m) => `${m.name}: ${m.state}`).join(", ")}
            />
            {down[0] && <div className="mt-2.5 truncate text-xs text-muted-foreground">{down[0].name}</div>}
          </Link>
        )}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                "flex items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-raised aria-expanded:bg-raised",
                collapsed && "justify-center",
              )}
            >
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
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mb-1 flex items-center gap-1 px-2 text-xs text-faint transition-colors hover:text-muted-foreground"
        >
          {label}
          <ChevronDown className={cn("size-3 transition-transform duration-150", !open && "-rotate-90")} />
        </button>
      )}
      {open && <ul className="flex flex-col gap-0.5">{children}</ul>}
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
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150",
          active ? "bg-raised text-foreground" : "text-muted-foreground hover:bg-raised/60 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        {!collapsed && <span className="flex-1">{label}</span>}
        {!collapsed && count !== undefined && (
          <Mono className={cn("text-xs", alarm ? "text-danger" : "text-faint")}>{count}</Mono>
        )}
      </Link>
    </li>
  )
}
