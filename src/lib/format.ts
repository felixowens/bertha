import type { IsoDate, Snooze } from "../contract/domain"
import { now } from "./clock"

const nf = new Intl.NumberFormat("en-GB")
export const num = (n: number) => nf.format(n)

/** 48312 → "48.3k", 912 → "912". */
export function compact(n: number): string {
  if (n < 10_000) return nf.format(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}

const ms = (d: IsoDate) => new Date(d).getTime()

/** Duration in the reference's readout style: "38h 5m", "4d 2h", "25m". */
export function duration(fromMs: number, toMs = now()): string {
  const mins = Math.max(0, Math.round((toMs - fromMs) / 60000))
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 48) return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  if (d < 60) return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
  return `${Math.floor(d / 30)}mo`
}

/** A length of time to the second: "850ms", "42s", "3m 12s", "2h 5m", "3d 4h". */
export function elapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

/** "4m ago", "16h ago", "3d ago". */
export function ago(d: IsoDate | null): string {
  if (!d) return "never"
  const s = duration(ms(d))
  return s === "now" ? "just now" : `${s.split(" ")[0]} ago`
}

export const since = (d: IsoDate) => duration(ms(d))

/** "in 5d", "in 3h": how long until a moment ahead. */
export const until = (d: IsoDate) => `in ${duration(now(), ms(d)).split(" ")[0]}`

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
const clockFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
  timeZone: "UTC",
})
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

export const date = (d: IsoDate) => dateFmt.format(new Date(d))
export const time = (d: IsoDate) => timeFmt.format(new Date(d))
/** "09:12:03.481", for breadcrumbs, where the order within a second matters. */
export const clock = (d: IsoDate) => clockFmt.format(new Date(d))
export const day = (d: IsoDate) => dayFmt.format(new Date(d))
/** "13 Oct 09:12" */
export const stamp = (d: IsoDate) => `${date(d)} ${time(d)}`

/** Signed percentage change against the previous period. */
export function delta(value: number, previous: number): { text: string; dir: "up" | "down" | "flat" } {
  // Nothing last time: a percentage means nothing, so say how many more.
  if (previous === 0) return value === 0 ? { text: "±0", dir: "flat" } : { text: `+${nf.format(value)}`, dir: "up" }
  const p = ((value - previous) / previous) * 100
  if (Math.abs(p) < 0.5) return { text: "±0%", dir: "flat" }
  const r = p >= 100 ? `${(value / previous).toFixed(1)}×` : `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(0)}%`
  return { text: r, dir: p > 0 ? "up" : "down" }
}

export function snoozeText(s: Snooze): string {
  return s.kind === "until" ? `until ${date(s.until)}` : `${num(s.remaining)} of ${num(s.total)} events left`
}

export const initials = (name: string) =>
  name.includes("@")
    ? name.slice(0, 2).toUpperCase()
    : name
        .split(/[\s-]+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()

export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`

/** A release named by a full commit SHA reads as its short form; any other name is kept. */
export const version = (v: string) => (/^[0-9a-f]{12,40}$/i.test(v) ? v.slice(0, 7) : v)

/** 1536 → "1.5 KB", 2_400_000_000 → "2.2 GB". */
export function bytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${i === 0 || n >= 100 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}
