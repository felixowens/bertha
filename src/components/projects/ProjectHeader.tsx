import { ExternalLink } from "lucide-react"
import { cn } from "cn"
import { Indicator } from "@/components/ui/motion"
import type { Monitor, Project } from "../../contract/domain"
import { Mono, Square, toneText } from "@/components/ui/primitives"
import { ago, since } from "@/lib/format"
import { healthLabel, healthTone } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { parseRepo } from "@/lib/links"

export type ProjectTab = "overview" | "issues" | "releases" | "uptime" | "logs" | "settings"

export const projectTabs = (id: string): { tab: ProjectTab; label: string; to: string }[] => [
  { tab: "overview", label: "Overview", to: `/projects/${id}` },
  { tab: "issues", label: "Issues", to: `/issues?project=${id}` },
  { tab: "releases", label: "Releases", to: `/releases?project=${id}` },
  { tab: "uptime", label: "Uptime", to: `/uptime?project=${id}` },
  { tab: "logs", label: "Logs", to: `/projects/${id}/logs` },
  { tab: "settings", label: "Settings", to: `/projects/${id}/settings` },
]

/** "down 25m", "healthy", "awaiting first event": a project's state, with its own duration where known. */
export function healthReadout(p: Project, monitors: Monitor[] = []): string {
  if (p.health === "down") {
    const m = monitors.filter((x) => x.projectId === p.id && x.state === "down").sort((a, b) => a.since.localeCompare(b.since))[0]
    return m ? `down ${since(m.since)}` : "down"
  }
  return healthLabel[p.health].toLowerCase()
}

const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "")

/** A project's name, what it is, how it stands, and its tabs. */
export function ProjectHeader({ project: p, active, monitors }: { project: Project; active: ProjectTab; monitors?: Monitor[] }) {
  const tone = healthTone[p.health]
  return (
    <header className="border-b border-hairline px-4 pt-5 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <Mono className="rounded-[3px] border border-hairline px-1 text-muted-foreground" title="Issue IDs start with this key">
          {p.key}
        </Mono>
        {p.client ? <span>for {p.client}</span> : <span>Personal project</span>}
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-mono hover:text-foreground">
            <span className="truncate">{host(p.url)}</span> <ExternalLink className="size-3 shrink-0" />
          </a>
        )}
        {p.repoUrl && (
          <a href={p.repoUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-mono hover:text-foreground">
            <span className="truncate">{parseRepo(p.repoUrl)?.path ?? host(p.repoUrl)}</span> <ExternalLink className="size-3 shrink-0" />
          </a>
        )}
      </div>
      <h1 className="mt-2 text-xl text-foreground md:text-2xl">{p.name}</h1>
      <p className={cn("mt-1.5 flex items-center gap-2 font-mono text-sm", toneText[tone])}>
        <Square tone={tone} hollow={p.health === "awaiting_first_event"} />
        {healthReadout(p, monitors)}
        <span className="text-faint">· {p.lastEventAt ? `last event ${ago(p.lastEventAt)}` : "no events yet"}</span>
      </p>
      <nav aria-label="Project" className="relative -mb-px mt-5 flex gap-1 overflow-x-auto">
        <Indicator selector='[aria-current="page"]' watch={active} remember={`project-tabs:${p.id}`} className="border-b-2 border-foreground" />
        {projectTabs(p.id).map((t) => (
          <Link
            key={t.tab}
            to={t.to}
            aria-current={t.tab === active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-2.5 pb-2.5 text-sm transition-colors duration-150",
              t.tab === active ? "border-transparent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.tab === "issues" && p.unresolvedIssues > 0 && <Mono className="ml-1.5 text-xs text-faint">{p.unresolvedIssues}</Mono>}
            {t.tab === "uptime" && p.monitorIds.length > 0 && <Mono className="ml-1.5 text-xs text-faint">{p.monitorIds.length}</Mono>}
          </Link>
        ))}
      </nav>
    </header>
  )
}
