// The logs page's filter, its URL, and the log search. The search mirrors bertha's.
import type { LogFilter, LogLevel, LogLine, LogRange } from "../contract/domain"

/** Lowest first. */
export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warning", "error", "fatal"]
const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warning: 2, error: 3, fatal: 4 }
export const atLeast = (level: LogLevel, min: LogLevel) => RANK[level] >= RANK[min]
export const worse = (a: LogLevel, b: LogLevel) => (RANK[a] >= RANK[b] ? a : b)

export const LOG_RANGES: LogRange[] = ["1h", "24h", "7d", "30d"]
export const RANGE_MS: Record<LogRange, number> = { "1h": 3600e3, "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3, "30d": 30 * 24 * 3600e3 }
/** Buckets of the volume strip, per range. */
export const BUCKET_SECONDS: Record<LogRange, number> = { "1h": 60, "24h": 15 * 60, "7d": 2 * 3600, "30d": 8 * 3600 }

export const DEFAULT_LOG_FILTER: LogFilter = { projectIds: [], minLevel: "info", query: "", range: "24h", until: null, patternId: null }

export type LogView = "lines" | "patterns"

/** The filter lives in the URL, so issue pages and alerts can link to a search. */
export function logFilterFromQuery(q: URLSearchParams, projectId?: string, seed: Record<string, string> = {}): LogFilter {
  const d = DEFAULT_LOG_FILTER
  const get = (k: string) => q.get(k) ?? seed[k] ?? null
  const level = get("level") as LogLevel | null
  const range = get("range") as LogRange | null
  const until = get("until")
  return {
    projectIds: projectId ? [projectId] : (get("project")?.split(",").filter(Boolean) ?? d.projectIds),
    minLevel: level && LOG_LEVELS.includes(level) ? level : d.minLevel,
    query: get("q") ?? d.query,
    range: range && LOG_RANGES.includes(range) ? range : d.range,
    until: until && !Number.isNaN(Date.parse(until)) ? new Date(until).toISOString() : null,
    patternId: get("pattern") || null,
  }
}

export const logViewFromQuery = (q: URLSearchParams, seed: Record<string, string> = {}): LogView => ((q.get("view") ?? seed.view) === "patterns" ? "patterns" : "lines")

/** `projectRoute` leaves the project out: the path already holds it. */
export function logQueryFromFilter(f: LogFilter, view: LogView = "lines", keep?: URLSearchParams, projectRoute = false): string {
  const q = new URLSearchParams()
  for (const k of ["scenario", "viewer"]) if (keep?.get(k)) q.set(k, keep.get(k)!)
  const d = DEFAULT_LOG_FILTER
  if (f.projectIds.length && !projectRoute) q.set("project", f.projectIds.join(","))
  if (f.minLevel !== d.minLevel) q.set("level", f.minLevel)
  if (f.query) q.set("q", f.query)
  if (f.range !== d.range) q.set("range", f.range)
  if (f.until) q.set("until", f.until)
  if (f.patternId) q.set("pattern", f.patternId)
  if (view === "patterns") q.set("view", "patterns")
  const s = q.toString()
  return s ? `?${s}` : ""
}

export function logsHref(f: Partial<LogFilter>, view: LogView = "lines") {
  return `/logs${logQueryFromFilter({ ...DEFAULT_LOG_FILTER, ...f }, view)}`
}

/** The project's lines in the hour up to a minute after a line, with that line marked. */
export function aroundHref(line: Pick<LogLine, "id" | "projectId" | "at">) {
  const until = new Date(Date.parse(line.at) + 60e3).toISOString()
  return `${logsHref({ projectIds: [line.projectId], range: "1h", until })}&line=${encodeURIComponent(line.id)}`
}

/** Adds a search term to a query, unless it's already there. */
export const withTerm = (query: string, term: string) => (query.split(/\s+/).includes(term) ? query : `${query} ${term}`.trim())

/** Whether the filter is the one a fresh page starts with (projects aside). */
export const isDefaultLogFilter = (f: LogFilter) => logQueryFromFilter({ ...f, projectIds: [] }) === ""

/** The smallest range that holds a moment, so a link to it shows it. */
export function rangeHolding(at: string, now: number): LogRange {
  const ago = now - Date.parse(at)
  return LOG_RANGES.find((r) => RANGE_MS[r] >= ago + 5 * 60e3) ?? "30d"
}

// ── Search ──────────────────────────────────────────────────────────────

export type LogSearch = {
  /** Lowercased words and phrases; each must be in the message. */
  words: string[]
  /** Lowercased keys and values; each must equal a field, or release/service/environment/trace. */
  fields: [string, string][]
}

const KEY = /^[a-z_][a-z0-9_.-]*$/i

/** `checkout "fell back" status:502` → words ["checkout", "fell back"], fields [["status", "502"]]. */
export function parseLogQuery(query: string): LogSearch {
  const words: string[] = []
  const fields: [string, string][] = []
  for (const m of query.matchAll(/"([^"]*)"?|(\S+)/g)) {
    if (m[1] !== undefined) {
      if (m[1].trim()) words.push(m[1].trim().toLowerCase())
      continue
    }
    const token = m[2]!
    const at = token.indexOf(":")
    const key = at < 0 ? "" : token.slice(0, at)
    const value = token.slice(at + 1).replace(/^"|"$/g, "")
    if (KEY.test(key) && value && !value.startsWith("//")) fields.push([key.toLowerCase(), value.toLowerCase()])
    else words.push(token.toLowerCase())
  }
  return { words, fields }
}

export function matchesLine(line: LogLine, s: LogSearch): boolean {
  const message = line.message.toLowerCase()
  if (!s.words.every((w) => message.includes(w))) return false
  return s.fields.every(([k, v]) => {
    const own = k === "release" ? line.release : k === "service" ? line.service : k === "environment" ? line.environment : k === "trace" ? line.traceId : null
    if (own !== null && own.toLowerCase() === v) return true
    return Object.entries(line.fields).some(([fk, fv]) => fk.toLowerCase() === k && fv.toLowerCase() === v)
  })
}

/** A search term for a field's value, quoted when it has spaces. */
export const fieldTerm = (key: string, value: string) => `${key}:${/\s/.test(value) ? `"${value}"` : value}`

// ── Patterns ────────────────────────────────────────────────────────────

const REPLACE: [RegExp, string][] = [
  [/https?:\/\/\S+/g, "<url>"],
  [/"[^"]*"|'[^']*'/g, "<str>"],
  [/(?:^|(?<=\s))(?:\/[\w.@%+-]+)+\/?/g, "<path>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?/g, "<date>"],
  [/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/gi, "<hex>"],
  // A number with its unit keeps the unit: "240ms" → "<n>ms".
  [/\b\d+(?:[.:]\d+)*(?=(?:ms|s|m|h|d|b|kb|mb|gb)\b|%)/gi, "<n>"],
  [/\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]+\b/gi, "<id>"],
  [/\d+(?:[.:]\d+)*/g, "<n>"],
]

/** The message with its numbers, ids, hex, quoted strings, paths and URLs replaced. */
export function templateOf(message: string): string {
  return REPLACE.reduce((m, [re, to]) => m.replace(re, to), message)
}

/** A stable id for a project's template. */
export function patternIdOf(projectId: string, template: string): string {
  let h = 2166136261
  for (const c of `${projectId}\n${template}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return `lp-${(h >>> 0).toString(36)}`
}
