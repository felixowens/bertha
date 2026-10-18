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

/** "4m ago", "16h ago", "3d ago". */
export function ago(d: IsoDate | null): string {
  if (!d) return "never"
  const s = duration(ms(d))
  return s === "now" ? "just now" : `${s.split(" ")[0]} ago`
}

export const since = (d: IsoDate) => duration(ms(d))

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })

export const date = (d: IsoDate) => dateFmt.format(new Date(d))
export const time = (d: IsoDate) => timeFmt.format(new Date(d))
export const day = (d: IsoDate) => dayFmt.format(new Date(d))
/** "13 Oct 09:12" */
export const stamp = (d: IsoDate) => `${date(d)} ${time(d)}`

/** Signed percentage change against the previous period. */
export function delta(value: number, previous: number): { text: string; dir: "up" | "down" | "flat" } {
  if (previous === 0) return value === 0 ? { text: "±0", dir: "flat" } : { text: "new", dir: "up" }
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
