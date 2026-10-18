import { lazy, Suspense, type ReactNode } from "react"
import { AppFrame } from "@/components/shell/AppFrame"
import { Toaster } from "@/components/ui/toast"
import { EmptyState } from "@/components/ui/states"
import { match, useLocation, Link, type RoutePattern } from "@/lib/router"
import { Overview } from "@/pages/Overview"
import { Issues } from "@/pages/Issues"
import { usesFixtures } from "@/data/backend"
import { useMinute } from "@/lib/clock"

// The overview and issue list load with the app; every other page loads when first opened.
const IssueDetail = lazy(() => import("@/pages/IssueDetail").then((m) => ({ default: m.IssueDetail })))
const Releases = lazy(() => import("@/pages/Releases").then((m) => ({ default: m.Releases })))
const ReleaseDetail = lazy(() => import("@/pages/ReleaseDetail").then((m) => ({ default: m.ReleaseDetail })))
const Uptime = lazy(() => import("@/pages/Uptime").then((m) => ({ default: m.Uptime })))
const MonitorDetail = lazy(() => import("@/pages/MonitorDetail").then((m) => ({ default: m.MonitorDetail })))
const ProjectSettings = lazy(() => import("@/pages/ProjectSettings").then((m) => ({ default: m.ProjectSettings })))
const NewProject = lazy(() => import("@/pages/NewProject").then((m) => ({ default: m.NewProject })))
const Alerts = lazy(() => import("@/pages/Alerts").then((m) => ({ default: m.Alerts })))
const Team = lazy(() => import("@/pages/Team").then((m) => ({ default: m.Team })))
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite").then((m) => ({ default: m.AcceptInvite })))
const SignIn = lazy(() => import("@/pages/SignIn").then((m) => ({ default: m.SignIn })))

/** The scenario index only exists alongside the fixture backend, never in a build. */
const ScenarioIndex = import.meta.env.DEV && usesFixtures
  ? lazy(() => import("@/pages/ScenarioIndex").then((m) => ({ default: m.ScenarioIndex })))
  : null

/** Pages that live outside the app frame, on the dotted backdrop. */
const STANDALONE: RoutePattern[] = ["/sign-in", "/invite/:token"]

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
    case "/projects/:projectId/settings":
      return <ProjectSettings key={params.projectId} projectId={params.projectId} />
    case "/projects/new":
      return <NewProject />
    case "/settings/alerts":
      return <Alerts />
    case "/settings/team":
      return <Team />
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

function NotFound() {
  return (
    <EmptyState className="p-10" cells="void" title="Nothing here.">
      That address doesn't match a page. <Link to="/" className="text-foreground underline underline-offset-4">Back to overview</Link>
    </EmptyState>
  )
}

export default function App() {
  const { path } = useLocation()
  // Re-render each minute so every "4m ago" on screen stays true.
  useMinute()
  if (ScenarioIndex && path === "/__scenarios") {
    return (
      <Suspense fallback={null}>
        <ScenarioIndex />
      </Suspense>
    )
  }
  const m = match(path)
  const body = !m ? (
    <AppFrame>
      <NotFound />
    </AppFrame>
  ) : STANDALONE.includes(m.pattern) ? (
    <Suspense fallback={null}>{page(m.pattern, m.params)}</Suspense>
  ) : (
    <AppFrame key={m.pattern}>
      {/* A page's code arrives in a few ms; the frame stays put meanwhile. */}
      <Suspense fallback={null}>{page(m.pattern, m.params)}</Suspense>
    </AppFrame>
  )
  return (
    <>
      {body}
      <Toaster />
    </>
  )
}
