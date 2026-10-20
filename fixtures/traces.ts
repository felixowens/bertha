// Invented traces: the spans bertha kept for an event's trace.
import type { EventTrace, TraceSpan } from "../src/contract/domain"

type Service = Pick<TraceSpan, "service" | "runtime" | "projectId">
const web: Service = {
  service: "harbour-web",
  runtime: "browser",
  projectId: "p-harbour",
}
const bookings: Service = {
  service: "harbour-bookings",
  runtime: "server",
  projectId: "p-harbour",
}
const sync: Service = {
  service: "practice-sync",
  runtime: "server",
  projectId: "p-harbour",
}

let n = 0
function span(on: Service, parentId: string | null, kind: TraceSpan["kind"], name: string, startMs: number, endMs: number, more: Partial<TraceSpan> = {}): TraceSpan {
  const id = more.id ?? `s${String(++n).padStart(15, "0")}`
  return {
    parentId,
    ...on,
    name,
    kind,
    startMs,
    durationMs: endMs - startMs,
    status: "ok",
    statusMessage: null,
    attributes: {},
    event: null,
    silent: null,
    ...more,
    id,
  }
}

const fetchIssue = {
  id: "i-harbour-fetch",
  shortId: "HARB-1J",
  level: "fatal",
  type: "FetchError",
  message: "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443",
} as const
const holdIssue = {
  id: "i-7",
  shortId: "HARB-1Q",
  level: "error",
  type: "UnhandledRejection",
  message: "Error: Booking slot 2026-10-14T09:30:00+01:00 with Dr. O'Sullivan-Reyes is no longer available",
} as const

const slotsQuery = "SELECT id, starts_at, dentist_id, held_until FROM slot WHERE practice_id = $1 AND starts_at >= $2 ORDER BY starts_at"
const appointmentsQuery = "SELECT a.id, a.starts_at, a.ends_at, a.dentist_id FROM appointments a JOIN rota r ON r.dentist_id = a.dentist_id WHERE a.practice = $1 AND a.day >= $2"

/** A slots request on the booking route: cache, query, then practice-sync. */
function slotsRequest(
  parent: string,
  at: number,
  end: number,
  opts: {
    slotsMs: number
    syncMs: number | "timeout"
    appointmentsMs?: number
    event?: TraceSpan["event"]
    id?: string
  },
) {
  const out: TraceSpan[] = []
  const syncMs = opts.syncMs
  const failed = syncMs === "timeout"
  const route = span(bookings, parent, "server", "GET /book/[practice]/slots", at + 30, end - 20, {
    id: opts.id,
    status: failed ? "error" : "ok",
    statusMessage: failed ? "FetchError: request to https://practice-sync.internal/slots failed" : null,
    attributes: {
      "http.route": "/book/[practice]/slots",
      "http.status_code": failed ? "502" : "200",
      "faas.instance": "lhr1::8x2kp",
      practice: "whitby",
    },
    event: opts.event ?? null,
  })
  out.push(route)
  let t = at + 40
  out.push(span(bookings, route.id, "client", "redis GET slots:whitby:2026-10-13", t, t + 3, { attributes: { "db.system": "redis", "cache.hit": "false" } }))
  t += 6
  out.push(
    span(bookings, route.id, "internal", "prisma slot.findMany", t, t + opts.slotsMs, {
      attributes: {
        "db.system": "postgresql",
        "db.statement": slotsQuery,
        "db.rows": "214",
      },
    }),
  )
  t += opts.slotsMs + 10
  if (syncMs === "timeout") {
    out.push(
      span(bookings, route.id, "client", "GET practice-sync.internal/slots", t, t + 8000, {
        status: "error",
        statusMessage: "connect ETIMEDOUT 10.4.2.17:443",
        attributes: {
          "http.method": "GET",
          "url.full": "https://practice-sync.internal/slots?practice=whitby&from=2026-10-13",
          "server.address": "10.4.2.17",
          timeout: "8000ms",
        },
        silent: "practice-sync.internal",
      }),
    )
  } else {
    const call = span(bookings, route.id, "client", "GET practice-sync.internal/slots", t, t + syncMs, {
      attributes: {
        "http.method": "GET",
        "url.full": "https://practice-sync.internal/slots?practice=whitby",
        "http.status_code": "200",
      },
    })
    const handler = span(sync, call.id, "server", "GET /slots", t + 20, t + syncMs - 20, {
      attributes: {
        "http.route": "/slots",
        "http.status_code": "200",
        "host.name": "sync-1",
      },
    })
    const q = opts.appointmentsMs ?? syncMs - 120
    out.push(
      call,
      handler,
      span(sync, handler.id, "client", "postgres SELECT appointments", t + 40, t + 40 + q, {
        attributes: {
          "db.system": "postgresql",
          "db.statement": appointmentsQuery,
          "db.rows": "1,862",
        },
      }),
    )
  }
  return { spans: out, route }
}

function harbourPage(): EventTrace {
  n = 0
  const root = span(web, null, "internal", "page /book/whitby", 0, 40_380, {
    attributes: {
      "url.full": "https://book.harbourdental.co.uk/book/whitby",
      "user_agent.original": "Mobile Safari 26.0 on iOS 26.0",
    },
  })
  const load = span(web, root.id, "internal", "document load", 0, 540, {
    attributes: { "navigation.type": "navigate" },
  })
  const render = span(bookings, load.id, "server", "GET /book/[practice]", 40, 410, {
    attributes: {
      "http.route": "/book/[practice]",
      "http.status_code": "200",
    },
  })
  const practice = span(bookings, render.id, "internal", "prisma practice.findUnique", 70, 84, { attributes: { "db.system": "postgresql" } })

  // The first slots fetch: a slow query, then practice-sync never answers.
  const first = span(web, root.id, "client", "GET /book/whitby/slots", 560, 15_640, {
    status: "error",
    statusMessage: "502 Bad Gateway",
    attributes: {
      "http.method": "GET",
      "url.full": "https://book.harbourdental.co.uk/book/whitby/slots?from=2026-10-13",
      "http.status_code": "502",
    },
  })
  const firstReq = slotsRequest(first.id, 560, 15_640, {
    slotsMs: 6_984,
    syncMs: "timeout",
    id: "00f067aa0ba902b7",
    event: { eventId: "e-harbour-1", issue: fetchIssue },
  })

  // "Try again": it works this time.
  const retry = span(web, root.id, "client", "GET /book/whitby/slots", 31_800, 33_060, {
    attributes: {
      "http.method": "GET",
      "url.full": "https://book.harbourdental.co.uk/book/whitby/slots?from=2026-10-13",
      "http.status_code": "200",
    },
  })
  const retryReq = slotsRequest(retry.id, 31_800, 33_060, {
    slotsMs: 484,
    syncMs: 680,
    appointmentsMs: 560,
  })

  // Booking the 09:30: practice-sync is slow again, and the slot has gone meanwhile.
  const book = span(web, root.id, "client", "POST /book/whitby", 36_100, 40_380, {
    status: "error",
    statusMessage: "500 Internal Server Error",
    attributes: {
      "http.method": "POST",
      "url.full": "https://book.harbourdental.co.uk/book/whitby",
      "http.status_code": "500",
      "next.action": "7f3a91c2e0",
    },
  })
  const action = span(bookings, book.id, "server", "action bookSlot", 36_130, 40_360, {
    id: "53995c3f42cd8ad8",
    status: "error",
    statusMessage: "Error: Booking slot 2026-10-14T09:30:00+01:00 with Dr. O'Sullivan-Reyes is no longer available",
    attributes: {
      "next.action": "7f3a91c2e0",
      "http.status_code": "500",
      slotId: "slot_8817",
    },
    event: { eventId: "e-harbour-hold-1", issue: holdIssue },
  })
  const recheck = span(bookings, action.id, "client", "GET practice-sync.internal/slots", 36_160, 39_272, {
    attributes: {
      "http.method": "GET",
      "url.full": "https://practice-sync.internal/slots?practice=whitby",
      "http.status_code": "200",
    },
  })
  const handler = span(sync, recheck.id, "server", "GET /slots", 36_190, 39_250, {
    attributes: {
      "http.route": "/slots",
      "http.status_code": "200",
      "host.name": "sync-1",
    },
  })
  const appointments = span(sync, handler.id, "client", "postgres SELECT appointments", 36_210, 39_130, {
    attributes: {
      "db.system": "postgresql",
      "db.statement": appointmentsQuery,
      "db.rows": "1,862",
    },
  })
  const hold = span(bookings, action.id, "internal", "prisma slot.findUnique", 39_290, 39_302, { attributes: { "db.system": "postgresql", "db.rows": "1" } })

  return {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    startedAt: "2026-10-13T09:11:19.400Z",
    durationMs: 40_380,
    truncated: 0,
    spans: [root, load, render, practice, first, ...firstReq.spans, retry, ...retryReq.spans, book, action, recheck, handler, appointments, hold],
  }
}

/** Kept traces by the event that pinned them. */
export const traces: Record<string, () => EventTrace> = {
  "e-harbour-1": harbourPage,
  "e-harbour-hold-1": harbourPage,
}
