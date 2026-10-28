import { Suspense, useRef, type ReactNode } from "react"
import { AppFrame } from "@/components/shell/AppFrame"
import { Toaster } from "@/components/ui/toast"
import { TipProvider } from "@/components/ui/tip"
import { EmptyState, LoadingCells } from "@/components/ui/states"
import { match, useLocation, Link, type RoutePattern } from "@/lib/router"
import { Overview } from "@/pages/Overview"
import { Issues } from "@/pages/Issues"
import { usesFixtures } from "@/data/backend"
import { useMinute } from "@/lib/clock"
import { lazyPage } from "@/lib/lazy-page"
import { PageError } from "@/components/shell/PageError"

// The overview and issue list load with the app; every other page loads when first opened.
const IssueDetail = lazyPage(() => import("@/pages/IssueDetail").then((m) => m.IssueDetail))
const Releases = lazyPage(() => import("@/pages/Releases").then((m) => m.Releases))
const ReleaseDetail = lazyPage(() => import("@/pages/ReleaseDetail").then((m) => m.ReleaseDetail))
const Uptime = lazyPage(() => import("@/pages/Uptime").then((m) => m.Uptime))
const MonitorDetail = lazyPage(() => import("@/pages/MonitorDetail").then((m) => m.MonitorDetail))
const ProjectSettings = lazyPage(() => import("@/pages/ProjectSettings").then((m) => m.ProjectSettings))
const Logs = lazyPage(() => import("@/pages/Logs").then((m) => m.Logs))
const Projects = lazyPage(() => import("@/pages/Projects").then((m) => m.Projects))
const MonitorReport = lazyPage(() => import("@/pages/MonitorReport").then((m) => m.MonitorReport))
const NewProject = lazyPage(() => import("@/pages/NewProject").then((m) => m.NewProject))
const Alerts = lazyPage(() => import("@/pages/Alerts").then((m) => m.Alerts))
const Team = lazyPage(() => import("@/pages/Team").then((m) => m.Team))
const Agents = lazyPage(() => import("@/pages/Agents").then((m) => m.Agents))
const AcceptInvite = lazyPage(() => import("@/pages/AcceptInvite").then((m) => m.AcceptInvite))
const SignIn = lazyPage(() => import("@/pages/SignIn").then((m) => m.SignIn))

/** The scenario index only exists alongside the fixture backend, never in a build. */
const ScenarioIndex = import.meta.env.DEV && usesFixtures ? lazyPage(() => import("@/pages/ScenarioIndex").then((m) => m.ScenarioIndex)) : null

/** Pages that live outside the app frame, on the dotted backdrop. */
const STANDALONE: RoutePattern[] = ["/sign-in", "/invite/:token", "/uptime/:monitorId/report"]

function page(pattern: RoutePattern, params: Record<string, string>): ReactNode {
  switch (pattern) {
    case "/":
      return <Overview />
    case "/issues":
      return <Issues />
    case "/issues/:issueId":
      return <IssueDetail key={params.issueId} issueId={params.issueId} />
    case "/releases":
      return <Releases />
    case "/releases/:releaseId":
      return <ReleaseDetail key={params.releaseId} releaseId={params.releaseId} />
    case "/uptime":
      return <Uptime />
    case "/uptime/:monitorId":
      return <MonitorDetail key={params.monitorId} monitorId={params.monitorId} />
    case "/logs":
      return <Logs />
    case "/projects/:projectId/logs":
      return <Logs key={params.projectId} projectId={params.projectId} />
    case "/projects/:projectId/settings":
      return <ProjectSettings key={params.projectId} projectId={params.projectId} />
    case "/uptime/:monitorId/report":
      return <MonitorReport key={params.monitorId} monitorId={params.monitorId} />
    case "/projects":
      return <Projects />
    case "/projects/:projectId":
      return <Overview key={params.projectId} projectId={params.projectId} />
    case "/projects/new":
      return <NewProject />
    case "/projects/:projectId/connect":
      return <NewProject key={params.projectId} projectId={params.projectId} />
    case "/settings/alerts":
      return <Alerts />
    case "/settings/team":
      return <Team />
    case "/settings/agents":
      return <Agents />
    case "/invite/:token":
      return <AcceptInvite key={params.token} token={params.token} />
    case "/sign-in":
      return <SignIn />
    default:
      return <Pending />
  }
}

function Pending() {
  return (
    <EmptyState className="p-10" cells="void" title="Not drawn yet.">
      This page is next in the build order.
    </EmptyState>
  )
}

/** Shown only if a page's code is slow to arrive; fades in late so a fast load never flashes it. */
function Loading() {
  return (
    <div className="grid min-h-[50vh] animate-appear-late place-items-center">
      <LoadingCells label="Loading" />
    </div>
  )
}

/** One page's blocks. Each fades in as it mounts (see `[data-page]` in index.css). */
function Page({ children, calm }: { children: ReactNode; calm?: boolean }) {
  return (
    <div data-page className={calm ? undefined : "animate-page-in"}>
      {children}
    </div>
  )
}

const projectOf = (path: string) => /^\/projects\/(?!new$)([^/]+)/.exec(path)?.[1] ?? null

/**
 * True when this page is another tab of the project on screen before it: the header
 * stays, so the page doesn't rise in again. Worked out once per path.
 */
function useCalm(path: string) {
  const seen = useRef({ path, calm: false })
  if (seen.current.path !== path) {
    const before = projectOf(seen.current.path)
    seen.current = { path, calm: before !== null && before === projectOf(path) }
  }
  return seen.current.calm
}

function NotFound() {
  return (
    <EmptyState className="p-10" cells="void" title="Nothing here.">
      That address doesn't match a page.{" "}
      <Link to="/" className="text-foreground underline underline-offset-4">
        Back to overview
      </Link>
    </EmptyState>
  )
}

export default function App() {
  const { path } = useLocation()
  // Re-render each minute so every "4m ago" on screen stays true.
  useMinute()
  const calm = useCalm(path)
  if (ScenarioIndex && path === "/__scenarios") {
    return (
      <Suspense fallback={null}>
        <ScenarioIndex />
      </Suspense>
    )
  }
  const m = match(path)
  // Keyed by path, so each page arrives with a short fade; the frame around it stays put.
  const body = !m ? (
    <AppFrame>
      <Page key={path}>
        <NotFound />
      </Page>
    </AppFrame>
  ) : STANDALONE.includes(m.pattern) ? (
    <PageError key={path}>
      <Suspense fallback={<Loading />}>
        <Page key={path}>{page(m.pattern, m.params)}</Page>
      </Suspense>
    </PageError>
  ) : (
    <AppFrame>
      {/* A page's code arrives in a few ms; the frame stays put meanwhile. */}
      <PageError key={path}>
        <Suspense fallback={<Loading />}>
          <Page key={path} calm={calm}>
            {page(m.pattern, m.params)}
          </Page>
        </Suspense>
      </PageError>
    </AppFrame>
  )
  return (
    <TipProvider>
      {body}
      <Toaster />
    </TipProvider>
  )
}
