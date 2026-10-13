import type { ReactNode } from "react"
import { AppFrame } from "@/components/shell/AppFrame"
import { Toaster } from "@/components/ui/toast"
import { EmptyState } from "@/components/ui/states"
import { match, useLocation, Link, type RoutePattern } from "@/lib/router"
import { Overview } from "@/pages/Overview"
import { Issues } from "@/pages/Issues"
import { IssueDetail } from "@/pages/IssueDetail"
import { Releases } from "@/pages/Releases"
import { Uptime } from "@/pages/Uptime"
import { MonitorDetail } from "@/pages/MonitorDetail"
import { ProjectSettings } from "@/pages/ProjectSettings"
import { NewProject } from "@/pages/NewProject"
import { Alerts } from "@/pages/Alerts"
import { Team } from "@/pages/Team"
import { AcceptInvite } from "@/pages/AcceptInvite"
import { SignIn } from "@/pages/SignIn"
import { ReleaseDetail } from "@/pages/ReleaseDetail"
import { ScenarioIndex } from "@/pages/ScenarioIndex"

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
  if (path === "/__scenarios") return <ScenarioIndex />
  const m = match(path)
  const body = !m ? (
    <AppFrame>
      <NotFound />
    </AppFrame>
  ) : STANDALONE.includes(m.pattern) ? (
    page(m.pattern, m.params)
  ) : (
    <AppFrame key={m.pattern}>{page(m.pattern, m.params)}</AppFrame>
  )
  return (
    <>
      {body}
      <Toaster />
    </>
  )
}
