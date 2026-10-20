import type { IssueFilter, SavedView } from "../../contract/domain"

export const DEFAULT_FILTER: IssueFilter = {
  projectIds: [],
  status: "unresolved",
  levels: [],
  environment: "all",
  assignee: "anyone",
  query: "",
  sort: "last_seen",
  range: "7d",
  labels: [],
}

/** The filter lives in the URL so every view is linkable (and screenshot-able). */
export function filterFromQuery(q: URLSearchParams, views: SavedView[], seed: Record<string, string> = {}): IssueFilter {
  const view = views.find((v) => v.id === q.get("view"))
  const base: IssueFilter = { ...DEFAULT_FILTER, ...(view?.filter ?? {}) }
  const get = (k: string) => q.get(k) ?? seed[k] ?? null
  const list = (k: string) => get(k)?.split(",").filter(Boolean)
  return {
    projectIds: list("project") ?? base.projectIds,
    status: (get("status") as IssueFilter["status"]) ?? base.status,
    levels: (list("level") as IssueFilter["levels"]) ?? base.levels,
    environment: (get("env") as IssueFilter["environment"]) ?? base.environment,
    assignee: (get("assignee") as IssueFilter["assignee"]) ?? base.assignee,
    query: get("query") ?? base.query,
    sort: (get("sort") as IssueFilter["sort"]) ?? base.sort,
    range: (get("range") as IssueFilter["range"]) ?? base.range,
    labels: list("label") ?? base.labels,
    ...(TRIAGES.includes(get("triage") ?? base.triage ?? "") ? { triage: (get("triage") ?? base.triage) as NonNullable<IssueFilter["triage"]> } : {}),
    ...(list("ids") ? { ids: list("ids") } : {}),
    ...((get("new") ?? (base.newInRange ? "1" : null)) === "1" ? { newInRange: true as const } : {}),
  }
}

const TRIAGES: string[] = ["active", "never", "fix_waiting"] satisfies NonNullable<IssueFilter["triage"]>[]

export function queryFromFilter(f: IssueFilter, keep?: URLSearchParams): string {
  const q = new URLSearchParams()
  if (keep?.get("scenario")) q.set("scenario", keep.get("scenario")!)
  if (keep?.get("viewer")) q.set("viewer", keep.get("viewer")!)
  const d = DEFAULT_FILTER
  if (f.projectIds.length) q.set("project", f.projectIds.join(","))
  if (f.status !== d.status) q.set("status", f.status)
  if (f.levels.length) q.set("level", f.levels.join(","))
  if (f.environment !== d.environment) q.set("env", f.environment)
  if (f.assignee !== d.assignee) q.set("assignee", f.assignee)
  if (f.query) q.set("query", f.query)
  if (f.sort !== d.sort) q.set("sort", f.sort)
  if (f.range !== d.range) q.set("range", f.range)
  if (f.labels.length) q.set("label", f.labels.join(","))
  if (f.triage) q.set("triage", f.triage)
  if (f.ids?.length) q.set("ids", f.ids.join(","))
  if (f.newInRange) q.set("new", "1")
  const s = q.toString()
  return s ? `?${s}` : ""
}

export const viewHref = (v: SavedView) => `/issues?view=${v.id}`

/** A triage queue: exactly these issues, newest activity first. */
export const queueHref = (ids: string[], range: IssueFilter["range"]) => `/issues${queryFromFilter({ ...DEFAULT_FILTER, range, ids })}`

/** Where an issue sits in the list that opened it, so detail can step to the next one. */
const QUEUE_KEY = "bertha.queue"
export type Queue = { ids: string[]; back: string }
export function saveQueue(q: Queue) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    /* stepping through is a convenience */
  }
}
export function readQueue(): Queue | null {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY)
    const q = raw ? (JSON.parse(raw) as Queue) : null
    return q && Array.isArray(q.ids) && typeof q.back === "string" ? q : null
  } catch {
    return null
  }
}

export function isDefault(f: IssueFilter) {
  return queryFromFilter(f) === ""
}
