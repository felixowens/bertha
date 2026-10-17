// Writes packet/fixtures as one JSON file for `bertha seed`.
// Run: node scripts/export-fixtures.ts (Node 24 strips the types).
import { writeFileSync } from "node:fs"
import { alertRules, destinations } from "../packet/fixtures/alerts.ts"
import { events } from "../packet/fixtures/events.ts"
import { issues } from "../packet/fixtures/issues.ts"
import { monitorHistory, monitors } from "../packet/fixtures/monitors.ts"
import { members } from "../packet/fixtures/people.ts"
import { projectSetups, projects } from "../packet/fixtures/projects.ts"
import { releases } from "../packet/fixtures/releases.ts"
import { invites } from "../packet/fixtures/shell.ts"

const out = new URL("../server/crates/bertha-db/seed/fixtures.json", import.meta.url)
const data = {
  // Every relative time in the fixtures is measured from here.
  now: "2026-10-13T09:12:00Z",
  members,
  projects,
  projectSetups,
  issues,
  events,
  releases,
  monitors,
  monitorHistory,
  alertRules,
  destinations,
  invites: Object.fromEntries(Object.entries(invites).map(([token, i]) => [token, i.status])),
}
writeFileSync(out, JSON.stringify(data) + "\n")
console.log(`wrote ${out.pathname}`)
