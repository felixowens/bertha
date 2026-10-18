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
  }
}

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
  const s = q.toString()
  return s ? `?${s}` : ""
}

export const viewHref = (v: SavedView) => `/issues?view=${v.id}`

export function isDefault(f: IssueFilter) {
  return queryFromFilter(f) === ""
}
