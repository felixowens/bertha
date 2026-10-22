// Writes fixtures/ as one JSON file for `bertha seed`.
// Run: node scripts/export-fixtures.ts (Node 24 strips the types).
import { writeFileSync } from "node:fs"
import { alertRules, destinations } from "../fixtures/alerts.ts"
import { events } from "../fixtures/events.ts"
import { issues } from "../fixtures/issues.ts"
import { logLines, logSettings } from "../fixtures/logs.ts"
import { monitorHistory, monitors } from "../fixtures/monitors.ts"
import { members } from "../fixtures/people.ts"
import { briefs, projectSetups, projects } from "../fixtures/projects.ts"
import { releases } from "../fixtures/releases.ts"
import { invites } from "../fixtures/shell.ts"
import { traces } from "../fixtures/traces.ts"

const out = new URL("../server/crates/bertha-db/seed/fixtures.json", import.meta.url)
const data = {
  // Every relative time in the fixtures is measured from here.
  now: "2026-10-13T09:12:00Z",
  members,
  projects,
  projectSetups,
  briefs,
  issues,
  events,
  releases,
  monitors,
  monitorHistory,
  alertRules,
  destinations,
  // Each kept trace once, however many events pin it.
  traces: [...new Map(Object.values(traces).map((t) => [t().traceId, t()])).values()],
  // Oldest first. Projects missing from logSettings keep info and above for 14 days.
  logs: logLines,
  logSettings,
  invites: Object.fromEntries(Object.entries(invites).map(([token, i]) => [token, i.status])),
}
writeFileSync(out, JSON.stringify(data) + "\n")
console.log(`wrote ${out.pathname}`)
