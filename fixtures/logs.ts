// Invented log lines: what the apps logged over the last two weeks, densest in the last
// day. Generated from a seed so they're the same on every load. St Aidan's newsletter,
// sundial.dev and Recipe box send no logs.
import type { Environment, LogDrop, LogLevel, LogLine, ProjectLogSettings } from "../src/contract/domain"

const NOW = Date.parse("2026-10-13T09:12:00Z")
const MIN = 60e3
const H = 60 * MIN


function seeded(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

type Rand = () => number
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const hex = (r: Rand, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("")

type Made = { message: string; fields?: Record<string, string> }
type Source = {
  level: LogLevel
  /** Relative weight among the project's sources. */
  weight: number
  service: string | null
  make: (r: Rand) => Made
}

type ProjectLogs = {
  projectId: string
  release: string
  environment: Environment
  /** Lines an hour in the last day, at the busiest hour; older days get a sixth. */
  perHour: number
  sources: Source[]
}

const products = ["speckled-oatmeal-mug-350ml", "hand-thrown-serving-bowl-large", "celadon-pasta-plate", "stoneware-jug-1l", "tenmoku-tea-bowl", "gift-card"]
const practices = ["whitby", "scarborough", "pickering", "malton"]
const dentists = ["Dr. O'Sullivan-Reyes", "Dr. Ahmed", "Dr. Kowalczyk", "Dr. Fenwick"]
const stations = [
  ["0065", "Whitby"],
  ["0062", "Scarborough"],
  ["0071", "Bridlington"],
  ["0053", "Hartlepool"],
] as const
const posts = ["hebrides-ferry", "lindisfarne-at-low-tide", "kielder-dark-skies", "a-week-on-mull", "the-road-to-applecross"]

const kiln: ProjectLogs = {
  projectId: "p-kiln",
  release: "2026.10.12-1",
  environment: "production",
  perHour: 10,
  sources: [
    {
      level: "info",
      weight: 30,
      service: "kiln-web",
      make: (r) => {
        const slug = pick(r, products)
        return { message: `GET /products/${slug} 200 in ${int(r, 38, 420)}ms`, fields: { route: "/products/[slug]", status: "200" } }
      },
    },
    { level: "info", weight: 10, service: "kiln-web", make: (r) => ({ message: `GET /shop/mugs 200 in ${int(r, 41, 260)}ms`, fields: { route: "/shop/[collection]", status: "200" } }) },
    { level: "info", weight: 6, service: "kiln-web", make: (r) => ({ message: `Revalidated /products/${pick(r, products)}`, fields: { reason: "stock-webhook" } }) },
    { level: "info", weight: 5, service: "kiln-web", make: (r) => ({ message: `Stock webhook: ${int(r, 1, 14)} variants updated`, fields: { source: "shopify" } }) },
    {
      level: "info",
      weight: 4,
      service: "kiln-web",
      make: (r) => ({ message: `Order KC-${int(r, 20410, 20990)} paid, £${int(r, 18, 240)}.${pick(r, ["00", "50", "95"])}`, fields: { method: pick(r, ["card", "card", "apple_pay", "paypal"]) } }),
    },
    {
      level: "warning",
      weight: 2,
      service: "kiln-web",
      make: (r) => ({
        message: "Royal Mail rates failed, fell back to flat-rate shipping",
        fields: { reason: pick(r, ["timeout", "timeout", "http_503", "bad_payload"]), postcode: pick(r, ["YO21 3", "YO22 4", "LS6 2", "EH3 9"]) },
      }),
    },
    { level: "warning", weight: 1, service: "kiln-web", make: (r) => ({ message: `Image /products/${pick(r, products)}/hero.jpg has no width, served it unoptimised` }) },
    {
      level: "error",
      weight: 0.4,
      service: "kiln-web",
      make: (r) => ({ message: `Checkout session failed: Stripe returned 402 card_declined`, fields: { order: `KC-${int(r, 20410, 20990)}`, decline_code: pick(r, ["insufficient_funds", "do_not_honor", "expired_card"]) } }),
    },
  ],
}

const harbour: ProjectLogs = {
  projectId: "p-harbour",
  release: "v2.14.0",
  environment: "production",
  perHour: 8,
  sources: [
    {
      level: "info",
      weight: 20,
      service: "harbour-bookings",
      make: (r) => {
        const p = pick(r, practices)
        return { message: `GET /book/${p}/slots 200 in ${int(r, 90, 1400)}ms`, fields: { practice: p, route: "/book/[practice]/slots" } }
      },
    },
    {
      level: "info",
      weight: 6,
      service: "harbour-bookings",
      make: (r) => {
        const p = pick(r, practices)
        return { message: `Booked a check-up with ${pick(r, dentists)} at ${p}`, fields: { practice: p, slot: `2026-10-${int(r, 14, 28)}T${pick(r, ["09:30", "10:15", "11:00", "14:45", "16:20"])}:00+01:00` } }
      },
    },
    {
      level: "info",
      weight: 8,
      service: "practice-sync",
      make: (r) => {
        const p = pick(r, practices)
        return { message: `Pulled ${int(r, 40, 1862)} appointments for ${p}`, fields: { practice: p } }
      },
    },
    {
      level: "warning",
      weight: 2,
      service: "harbour-bookings",
      make: (r) => {
        const p = pick(r, practices)
        return { message: "practice-sync was slow, served cached slots", fields: { practice: p, waited_ms: String(int(r, 3000, 9800)) } }
      },
    },
    {
      level: "warning",
      weight: 1,
      service: "harbour-bookings",
      make: (r) => ({ message: "SMS reminder failed, sent email instead", fields: { reason: pick(r, ["twilio_429", "invalid_number", "twilio_429"]) } }),
    },
  ],
}

const moss: ProjectLogs = {
  projectId: "p-moss",
  release: "v3.8.1",
  environment: "production",
  perHour: 3,
  sources: [
    {
      level: "info",
      weight: 6,
      service: "mossgrove-enquiries",
      make: (r) => ({
        message: `Enquiry received for 2027-${String(int(r, 4, 9)).padStart(2, "0")}-${String(int(r, 1, 28)).padStart(2, "0")} (${pick(r, ["ceremony-and-reception", "reception", "private-dining"])})`,
        fields: { guests: String(int(r, 30, 180)) },
      }),
    },
    { level: "info", weight: 8, service: "mossgrove-enquiries", make: (r) => ({ message: `Availability for ${pick(r, ["June", "July", "August", "September"])} 2027: ${int(r, 0, 9)} Saturdays free` }) },
    {
      level: "warning",
      weight: 1.5,
      service: "mossgrove-enquiries",
      make: (r) => ({ message: `Google Calendar sync failed, using the sync from ${int(r, 6, 55)}m ago`, fields: { reason: pick(r, ["timeout", "invalid_grant", "http_500"]) } }),
    },
  ],
}

const tides: ProjectLogs = {
  projectId: "p-tides",
  release: "ca4fda5",
  environment: "production",
  perHour: 5,
  sources: [
    {
      level: "info",
      weight: 20,
      service: "tide-times-api",
      make: (r) => {
        const [id] = pick(r, stations)
        return { message: `GET /v1/stations/${id}/tides 200 in ${int(r, 4, 90)}ms`, fields: { station: id } }
      },
    },
    {
      level: "info",
      weight: 4,
      service: "tide-times-api",
      make: (r) => {
        const [id, name] = pick(r, stations)
        return { message: `Refreshed station feed ${id} (${name})`, fields: { station: id, readings: String(int(r, 96, 144)) } }
      },
    },
    {
      level: "warning",
      weight: 2,
      service: "tide-times-api",
      make: (r) => {
        const [id, name] = pick(r, stations)
        return { message: "Admiralty feed failed, fell back to harmonic prediction", fields: { reason: pick(r, ["timeout", "http_503", "bad_payload", "rate_limited", "timeout"]), station: `${id} ${name}` } }
      },
    },
    { level: "error", weight: 0.3, service: "tide-times-api", make: () => ({ message: "fetch failed: ECONNRESET (station feed 0065 Whitby)", fields: { station: "0065" } }) },
  ],
}

const allot: ProjectLogs = {
  projectId: "p-allot",
  release: "27a7795",
  environment: "production",
  perHour: 2,
  sources: [
    { level: "info", weight: 6, service: "allotment-planner", make: (r) => ({ message: `Saved plan ${hex(r, 6)} (${int(r, 2, 14)} beds)` }) },
    { level: "debug", weight: 4, service: "allotment-planner", make: (r) => ({ message: `Computed crop rotation for bed ${int(r, 1, 14)} in ${int(r, 1, 40)}ms` }) },
    {
      level: "warning",
      weight: 1,
      service: "allotment-planner",
      make: (r) => ({ message: "Frost dates API failed, used regional averages", fields: { reason: pick(r, ["timeout", "http_404"]), region: pick(r, ["North Yorkshire", "Cumbria", "Lothian"]) } }),
    },
  ],
}

const field: ProjectLogs = {
  projectId: "p-field",
  release: "8cddf58",
  environment: "production",
  perHour: 1.5,
  sources: [
    { level: "info", weight: 4, service: null, make: (r) => ({ message: `Service worker updated to ${hex(r, 7)}` }) },
    { level: "info", weight: 3, service: null, make: (r) => ({ message: `Prefetched /posts/${pick(r, posts)}` }) },
    {
      level: "warning",
      weight: 2,
      service: null,
      make: (r) => ({ message: `Image not found: /images/2024/08/${pick(r, posts)}.jpg, showed the placeholder`, fields: { post: pick(r, posts) } }),
    },
  ],
}

/** `perHour` across the day: quiet overnight, busy in the morning and evening. */
const DAY_SHAPE = [0.15, 0.1, 0.08, 0.08, 0.1, 0.2, 0.4, 0.7, 0.9, 1, 0.95, 0.9, 0.85, 0.8, 0.8, 0.85, 0.9, 0.95, 1, 0.95, 0.8, 0.6, 0.4, 0.25]

let seq = 0
function line(at: number, projectId: string, level: LogLevel, made: Made, more: Partial<LogLine> & { service: string | null; release: string; environment: Environment }): LogLine {
  return {
    id: `l-${(++seq).toString(36).padStart(5, "0")}`,
    projectId,
    at: new Date(at).toISOString(),
    level,
    message: made.message,
    fields: made.fields ?? {},
    traceId: null,
    spanId: null,
    event: null,
    ...more,
  }
}

function generate(p: ProjectLogs): LogLine[] {
  const r = seeded(p.projectId)
  const total = p.sources.reduce((a, s) => a + s.weight, 0)
  const out: LogLine[] = []
  for (let hour = 0; hour < 14 * 24; hour++) {
    const start = NOW - (hour + 1) * H
    const shape = DAY_SHAPE[new Date(start).getUTCHours()]!
    const rate = p.perHour * shape * (hour < 24 ? 1 : 1 / 6) * (hour === 0 && (p.projectId === "p-kiln" || p.projectId === "p-harbour") ? 2.5 : 1)
    const n = Math.floor(rate) + (r() < rate % 1 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      let w = r() * total
      const source = p.sources.find((s) => (w -= s.weight) < 0) ?? p.sources[0]!
      // Allotment Planner keeps debug lines from its development box only.
      const dev = source.level === "debug"
      out.push(
        line(start + Math.floor(r() * H), p.projectId, source.level, source.make(r), {
          service: source.service,
          release: dev ? "27a7795-dirty" : p.release,
          environment: dev ? "development" : p.environment,
        }),
      )
    }
  }
  return out
}

/** The nightly invoice run at 02:00, and the aborted one on Friday afternoon. */
function invoiceRuns(): LogLine[] {
  const r = seeded("p-invoice")
  const base = { service: "invoice-runner", release: "0.9.0", environment: "production" as const }
  const out: LogLine[] = []
  for (let day = 0; day < 14; day++) {
    const start = Date.UTC(2026, 9, 13 - day, 2, 0, 0)
    if (start > NOW) continue
    const count = int(r, 9, 16)
    out.push(line(start, "p-invoice", "info", { message: `Invoice run started: ${count} invoices`, fields: { run: `run-${hex(r, 6)}` } }, base))
    let t = start + 400
    let fellBack = 0
    for (let i = 0; i < count; i++) {
      t += int(r, 300, 2200)
      const inv = `INV-${2026}${String(day * 50 + i).padStart(4, "0")}`
      if (r() < 0.06) {
        fellBack++
        out.push(line(t, "p-invoice", "warning", { message: "Chrome PDF render failed, fell back to wkhtmltopdf", fields: { invoice: inv, reason: pick(r, ["timeout", "crashed"]) } }, base))
      }
      out.push(line(t + 120, "p-invoice", "info", { message: `Rendered invoice ${inv} in ${int(r, 280, 1900)}ms` }, base))
    }
    out.push(line(t + 900, "p-invoice", "info", { message: `Invoice run finished: ${count} sent, 0 failed`, fields: { fell_back: String(fellBack) } }, base))
  }
  const fri = Date.parse("2026-10-10T15:31:00Z")
  out.push(line(fri, "p-invoice", "info", { message: "Invoice run started: 41 invoices", fields: { run: "run-manual" } }, base))
  for (const [i, inv] of ["INV-20261207", "INV-20261211", "INV-20261230"].entries()) {
    out.push(line(fri + 60e3 + i * 70e3, "p-invoice", "error", { message: `Invoice ${inv} failed to render: Chrome and wkhtmltopdf both timed out`, fields: { invoice: inv } }, base))
  }
  out.push(line(Date.parse("2026-10-10T15:36:00Z"), "p-invoice", "fatal", { message: "Invoice run aborted: 3 of 41 invoices failed to render (PDF renderer timed out)", fields: { run: "run-manual" } }, base))
  return out
}

/** The 502 on the booking page: practice-sync never answers, and the hold fails after. */
function harbourTrace(): LogLine[] {
  const traceId = "4bf92f3577b34da6a3ce929d0e0e4736"
  const bookings = { service: "harbour-bookings", release: "v2.14.0", environment: "production" as const, traceId }
  const t0 = Date.parse("2026-10-13T09:11:19.400Z")
  const at = (ms: number) => t0 + ms
  return [
    line(at(120), "p-harbour", "info", { message: "GET /book/whitby/slots started", fields: { practice: "whitby" } }, bookings),
    line(at(160), "p-harbour", "debug", { message: "slot cache miss for whitby 2026-10-13" }, bookings),
    line(at(7_420), "p-harbour", "warning", { message: "Slot query took 7104ms", fields: { practice: "whitby", rows: "1862" } }, bookings),
    line(at(7_460), "p-harbour", "info", { message: "Asking practice-sync for whitby slots", fields: { url: "https://practice-sync.internal/slots?practice=whitby&from=2026-10-13" } }, bookings),
    line(at(12_470), "p-harbour", "warning", { message: "practice-sync didn't answer in 5000ms, retrying once", fields: { attempt: "1" } }, bookings),
    line(
      Date.parse("2026-10-13T09:11:35Z"),
      "p-harbour",
      "fatal",
      { message: "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443", fields: { attempt: "2" } },
      { ...bookings, event: { issueId: "i-harbour-fetch", eventId: "e-harbour-1" } },
    ),
    line(Date.parse("2026-10-13T09:11:35.040Z"), "p-harbour", "info", { message: "GET /book/whitby/slots 502 in 15640ms", fields: { status: "502" } }, bookings),
    line(at(36_100), "p-harbour", "info", { message: "POST /book/whitby (server action hold)", fields: { practice: "whitby" } }, bookings),
    line(at(39_310), "p-harbour", "info", { message: "Slot 2026-10-14T09:30:00+01:00 held by another booking", fields: { practice: "whitby" } }, bookings),
    line(
      Date.parse("2026-10-13T09:11:59.760Z"),
      "p-harbour",
      "error",
      { message: "Error: Booking slot 2026-10-14T09:30:00+01:00 with Dr. O'Sullivan-Reyes is no longer available" },
      { ...bookings, event: { issueId: "i-7", eventId: "e-harbour-hold-1" } },
    ),
  ]
}

/** practice-sync has been unreachable since the monitor went down 25 minutes ago. */
function harbourOutage(): LogLine[] {
  const base = { service: "practice-sync", release: "v2.14.0", environment: "production" as const }
  const out: LogLine[] = []
  for (let t = Date.parse("2026-10-13T08:47:10Z"); t < NOW; t += 60e3) {
    out.push(line(t, "p-harbour", "error", { message: "connect ETIMEDOUT 10.4.2.17:443", fields: { host: "practice-sync.internal" } }, base))
  }
  return out
}

/** Around the cart error on the product page, on its trace. */
function kilnTrace(): LogLine[] {
  const traceId = "a3ce929d0e0e47364bf92f3577b34da6"
  const base = { release: "2026.10.12-1", environment: "production" as const, traceId }
  return [
    line(Date.parse("2026-10-13T09:08:58.902Z"), "p-kiln", "info", { message: "GET /products/speckled-oatmeal-mug-350ml 200 in 184ms", fields: { route: "/products/[slug]", status: "200" } }, { ...base, service: "kiln-web" }),
    line(Date.parse("2026-10-13T09:08:58.951Z"), "p-kiln", "warning", { message: "Variant 4419 has no stock levels, rendered without them", fields: { variant: "4419" } }, { ...base, service: "kiln-web" }),
    line(
      Date.parse("2026-10-13T09:08:59.497Z"),
      "p-kiln",
      "error",
      { message: "TypeError: Cannot read properties of undefined (reading 'map')", fields: { component: "VariantPicker" } },
      { ...base, service: "kiln-browser", event: { issueId: "i-cart-map", eventId: "e-cart-1" } },
    ),
  ]
}

/** The enquiry form's availability call failing as the regression came back. */
function mossRegression(): LogLine[] {
  const base = { service: "mossgrove-enquiries", release: "v3.8.1", environment: "production" as const }
  return [
    line(Date.parse("2026-10-13T08:20:41Z"), "p-moss", "info", { message: "Enquiry received for 2027-06-19 (ceremony-and-reception)", fields: { guests: "120" } }, base),
    line(Date.parse("2026-10-13T08:21:12Z"), "p-moss", "warning", { message: "Google Calendar sync failed, using the sync from 41m ago", fields: { reason: "invalid_grant" } }, base),
    line(Date.parse("2026-10-13T08:21:58Z"), "p-moss", "info", { message: "GET /api/availability?date=2027-06-19 503 in 30002ms", fields: { status: "503" } }, base),
    line(Date.parse("2026-10-13T08:22:00Z"), "p-moss", "error", { message: "TypeError: Failed to fetch" }, { ...base, service: "mossgrove-web", event: { issueId: "i-moss-regressed", eventId: "e-moss-1" } }),
  ]
}

/** Every kept line, oldest first. */
export const logLines: LogLine[] = [kiln, harbour, moss, tides, allot, field]
  .flatMap(generate)
  .concat(invoiceRuns(), harbourTrace(), harbourOutage(), kilnTrace(), mossRegression())
  .filter((l) => Date.parse(l.at) <= NOW)
  .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

/** What each project keeps. Allotment Planner keeps debug lines too, and Kiln & Clay a month. */
export const logSettings: Record<string, ProjectLogSettings> = {
  "p-kiln": { minLevel: "info", retentionDays: 30 },
  "p-allot": { minLevel: "debug", retentionDays: 14 },
}
export const DEFAULT_LOG_SETTINGS: ProjectLogSettings = { minLevel: "info", retentionDays: 14 }

/** Lines past the rate cap, for `?logs=dropped`: a retry loop in Kiln & Clay this morning. */
export const logDrops: LogDrop[] = [{ projectId: "p-kiln", lines: 4_812, since: "2026-10-13T08:51:00Z" }]

/** New lines for the live tail, `afterMs` after the page subscribes. */
export const liveLogs: { afterMs: number; line: Omit<LogLine, "id" | "at"> }[] = [
  { afterMs: 2_000, line: { projectId: "p-kiln", level: "info", message: "GET /products/tenmoku-tea-bowl 200 in 96ms", fields: { route: "/products/[slug]", status: "200" }, service: "kiln-web", release: "2026.10.12-1", environment: "production", traceId: null, spanId: null, event: null } },
  { afterMs: 3_500, line: { projectId: "p-harbour", level: "error", message: "connect ETIMEDOUT 10.4.2.17:443", fields: { host: "practice-sync.internal" }, service: "practice-sync", release: "v2.14.0", environment: "production", traceId: null, spanId: null, event: null } },
  { afterMs: 5_000, line: { projectId: "p-tides", level: "warning", message: "Admiralty feed failed, fell back to harmonic prediction", fields: { reason: "timeout", station: "0065 Whitby" }, service: "tide-times-api", release: "ca4fda5", environment: "production", traceId: null, spanId: null, event: null } },
  { afterMs: 6_200, line: { projectId: "p-kiln", level: "info", message: "Order KC-20994 paid, £64.50", fields: { method: "card" }, service: "kiln-web", release: "2026.10.12-1", environment: "production", traceId: null, spanId: null, event: null } },
  { afterMs: 8_000, line: { projectId: "p-harbour", level: "info", message: "GET /book/pickering/slots 200 in 412ms", fields: { practice: "pickering", route: "/book/[practice]/slots" }, service: "harbour-bookings", release: "v2.14.0", environment: "production", traceId: null, spanId: null, event: null } },
  { afterMs: 9_400, line: { projectId: "p-moss", level: "info", message: "Availability for July 2027: 3 Saturdays free", fields: {}, service: "mossgrove-enquiries", release: "v3.8.1", environment: "production", traceId: null, spanId: null, event: null } },
]
