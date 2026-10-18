// Generated fixture — invented data with realistic shape.
import type { Monitor } from "../src/contract/domain"
import type { MonitorDetailPage } from "../src/contract/pages"
type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never

/** Per monitor id: checks, incidents and response times. */
type MonitorHistory = Pick<Ready<MonitorDetailPage>, "checks" | "incidents" | "responseTimes">

export const monitors: Monitor[] = [
  {
    "id": "mon-kiln",
    "projectId": "p-kiln",
    "name": "Shop home",
    "url": "https://kilnandclay.co.uk",
    "intervalSeconds": 60,
    "state": "up",
    "since": "2026-10-04T09:12:00Z",
    "uptime30d": 99.62,
    "latestResponseMs": 249,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "degraded",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up"
    ]
  },
  {
    "id": "mon-harbour",
    "projectId": "p-harbour",
    "name": "Booking — slot search",
    "url": "https://book.harbourdental.co.uk/api/health?deep=1",
    "intervalSeconds": 60,
    "state": "down",
    "since": "2026-10-13T08:47:00Z",
    "uptime30d": 98.91,
    "latestResponseMs": null,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down"
    ]
  },
  {
    "id": "mon-moss",
    "projectId": "p-moss",
    "name": "Enquiry form",
    "url": "https://enquiries.mossgrovehall.co.uk/enquire",
    "intervalSeconds": 300,
    "state": "degraded",
    "since": "2026-10-13T08:02:00Z",
    "uptime30d": 99.4,
    "latestResponseMs": 4180,
    "recent": [
      "up",
      "up",
      "up",
      "down",
      "up",
      "up",
      "up",
      "degraded",
      "degraded",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "down",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "degraded",
      "degraded",
      "down",
      "up",
      "up",
      "up",
      "up",
      "up",
      "down",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "degraded",
      "up",
      "up",
      "degraded",
      "down",
      "degraded",
      "degraded"
    ]
  },
  {
    "id": "mon-tides",
    "projectId": "p-tides",
    "name": "Predictions endpoint",
    "url": "https://tides.sundial.dev/predict?station=0065&days=1",
    "intervalSeconds": 300,
    "state": "up",
    "since": "2026-09-17T09:12:00Z",
    "uptime30d": 99.99,
    "latestResponseMs": 210,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up"
    ]
  },
  {
    "id": "mon-allot",
    "projectId": "p-allot",
    "name": "Allotment Planner",
    "url": "https://plot.sundial.dev",
    "intervalSeconds": 900,
    "state": "up",
    "since": "2026-09-03T09:12:00Z",
    "uptime30d": 100,
    "latestResponseMs": 122,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up"
    ]
  },
  {
    "id": "mon-parish",
    "projectId": "p-parish",
    "name": "Newsletter site",
    "url": "https://staidans-whitby.org.uk",
    "intervalSeconds": 900,
    "state": "paused",
    "since": "2026-09-28T09:12:00Z",
    "uptime30d": 99.97,
    "latestResponseMs": 322,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ]
  },
  {
    "id": "mon-field",
    "projectId": "p-field",
    "name": "fieldnotes",
    "url": "https://fieldnotes.sundial.dev",
    "intervalSeconds": 900,
    "state": "up",
    "since": "2026-08-13T09:12:00Z",
    "uptime30d": 100,
    "latestResponseMs": 190,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up"
    ]
  },
  {
    "id": "mon-portfolio",
    "projectId": "p-portfolio",
    "name": "sundial.dev",
    "url": "https://sundial.dev",
    "intervalSeconds": 900,
    "state": "up",
    "since": "2026-08-13T09:12:00Z",
    "uptime30d": 100,
    "latestResponseMs": 234,
    "recent": [
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up"
    ]
  }
]

export const monitorHistory: Record<string, MonitorHistory> = {
  "mon-kiln": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 214,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:11:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 94,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:10:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 331,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:09:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 418,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:08:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 232,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 368,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:06:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 447,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:05:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 99,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:04:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 434,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T09:03:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 292,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 248,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:01:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 141,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:00:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 98,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:59:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 109,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:58:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 157,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 406,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:56:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 190,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:55:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 5640,
        "error": "Slow: over the 3s threshold",
        "region": "London"
      },
      {
        "at": "2026-10-13T08:54:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 327,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:53:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 425,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 269,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:51:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 366,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:50:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 155,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:49:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 122,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:48:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 242,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 300,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:46:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 278,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:45:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 215,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:44:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 353,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:43:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 269,
        "error": null,
        "region": "London"
      }
    ],
    "incidents": [
      {
        "id": "inc-k0",
        "startedAt": "2026-09-29T06:12:00Z",
        "resolvedAt": "2026-09-29T09:12:00Z",
        "cause": "TLS certificate expired (kilnandclay.co.uk, expired 29 Sep 2026 00:00 UTC)",
        "failedChecks": 182
      }
    ],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        370,
        374,
        92,
        161,
        101,
        107,
        399,
        124,
        383,
        90,
        352,
        159,
        227,
        272,
        105,
        177,
        149,
        308,
        393,
        124,
        213,
        161,
        129,
        141,
        336,
        377,
        270,
        237,
        215,
        376,
        4606,
        141,
        295,
        90,
        322,
        283,
        285,
        158,
        193,
        378,
        276,
        108,
        168,
        109,
        275,
        401,
        407,
        169
      ]
    }
  },
  "mon-harbour": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 43,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:11:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 90,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T09:10:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 33,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T09:09:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 53,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:08:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 54,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:07:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 56,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T09:06:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 69,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:05:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 41,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:04:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 51,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:03:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 85,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T09:02:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 58,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:01:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 45,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:00:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 86,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T08:59:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 30,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:58:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 58,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 44,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:56:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 45,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:55:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 43,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T08:54:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 86,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:53:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 76,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:52:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 65,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:51:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 63,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:50:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 39,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T08:49:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 43,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "London"
      },
      {
        "at": "2026-10-13T08:48:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 30,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:47:00Z",
        "ok": false,
        "httpStatus": 503,
        "responseMs": 41,
        "error": "HTTP 503 Service Unavailable — body: {\"ok\":false,\"failing\":[\"practice-sync\"]}",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:46:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 358,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:45:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 91,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:44:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 170,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:43:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 209,
        "error": null,
        "region": "Frankfurt"
      }
    ],
    "incidents": [
      {
        "id": "inc-h1",
        "startedAt": "2026-10-13T08:47:00Z",
        "resolvedAt": null,
        "cause": "HTTP 503 Service Unavailable",
        "failedChecks": 25
      },
      {
        "id": "inc-h0",
        "startedAt": "2026-09-24T09:12:00Z",
        "resolvedAt": "2026-09-24T09:16:00Z",
        "cause": "Timed out after 10s",
        "failedChecks": 4
      }
    ],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        238,
        221,
        408,
        405,
        259,
        288,
        345,
        197,
        409,
        342,
        317,
        266,
        304,
        292,
        171,
        333,
        402,
        413,
        208,
        231,
        417,
        205,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ]
    }
  },
  "mon-moss": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 7412,
        "error": "Slow: over the 3s threshold",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 5974,
        "error": "Slow: over the 3s threshold",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:02:00Z",
        "ok": false,
        "httpStatus": null,
        "responseMs": null,
        "error": "Timed out after 10s",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 6003,
        "error": "Slow: over the 3s threshold",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 363,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 248,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 7822,
        "error": "Slow: over the 3s threshold",
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:37:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 340,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:32:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 452,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 345,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:22:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 93,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:17:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 275,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 384,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 233,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 427,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 231,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 264,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:47:00Z",
        "ok": false,
        "httpStatus": null,
        "responseMs": null,
        "error": "Timed out after 10s",
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 263,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:37:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 88,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:32:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 383,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 390,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:22:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 142,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:17:00Z",
        "ok": false,
        "httpStatus": null,
        "responseMs": null,
        "error": "Timed out after 10s",
        "region": "London"
      },
      {
        "at": "2026-10-13T07:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 5764,
        "error": "Slow: over the 3s threshold",
        "region": "London"
      },
      {
        "at": "2026-10-13T07:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 7457,
        "error": "Slow: over the 3s threshold",
        "region": "London"
      },
      {
        "at": "2026-10-13T07:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 138,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 262,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 420,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 141,
        "error": null,
        "region": "London"
      }
    ],
    "incidents": [
      {
        "id": "inc-m0",
        "startedAt": "2026-10-13T05:54:00Z",
        "resolvedAt": "2026-10-13T05:59:00Z",
        "cause": "Timed out after 10s",
        "failedChecks": 1
      },
      {
        "id": "inc-m1",
        "startedAt": "2026-10-13T02:36:00Z",
        "resolvedAt": "2026-10-13T02:41:00Z",
        "cause": "Slow: over the 3s threshold",
        "failedChecks": 1
      },
      {
        "id": "inc-m2",
        "startedAt": "2026-10-12T23:18:00Z",
        "resolvedAt": "2026-10-12T23:23:00Z",
        "cause": "Timed out after 10s",
        "failedChecks": 1
      },
      {
        "id": "inc-m3",
        "startedAt": "2026-10-12T20:00:00Z",
        "resolvedAt": "2026-10-12T20:05:00Z",
        "cause": "Slow: over the 3s threshold",
        "failedChecks": 1
      },
      {
        "id": "inc-m4",
        "startedAt": "2026-10-12T16:42:00Z",
        "resolvedAt": "2026-10-12T16:47:00Z",
        "cause": "Timed out after 10s",
        "failedChecks": 1
      },
      {
        "id": "inc-m5",
        "startedAt": "2026-10-12T13:24:00Z",
        "resolvedAt": "2026-10-12T13:29:00Z",
        "cause": "Slow: over the 3s threshold",
        "failedChecks": 1
      },
      {
        "id": "inc-m6",
        "startedAt": "2026-10-12T10:06:00Z",
        "resolvedAt": "2026-10-12T10:11:00Z",
        "cause": "Timed out after 10s",
        "failedChecks": 1
      }
    ],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        172,
        291,
        251,
        null,
        112,
        141,
        377,
        4941,
        7883,
        231,
        200,
        353,
        234,
        261,
        322,
        null,
        222,
        349,
        295,
        273,
        210,
        386,
        5047,
        5945,
        null,
        90,
        127,
        244,
        97,
        400,
        null,
        132,
        102,
        150,
        177,
        274,
        240,
        297,
        242,
        299,
        124,
        7470,
        256,
        311,
        6764,
        null,
        5565,
        7414
      ]
    }
  },
  "mon-tides": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 254,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T09:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 195,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T09:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 362,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 173,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 182,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 134,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 386,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:37:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 221,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:32:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 215,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 268,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:22:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 156,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:17:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 337,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 187,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 158,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 271,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 268,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 231,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 321,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 262,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:37:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 159,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:32:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 115,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 450,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:22:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 235,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:17:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 447,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 136,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:07:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 92,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:02:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 104,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 232,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:52:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 438,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:47:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 208,
        "error": null,
        "region": "London"
      }
    ],
    "incidents": [],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        265,
        199,
        340,
        400,
        179,
        114,
        139,
        359,
        132,
        371,
        217,
        145,
        169,
        396,
        420,
        152,
        108,
        312,
        109,
        289,
        147,
        169,
        331,
        391,
        183,
        152,
        153,
        363,
        412,
        401,
        249,
        214,
        393,
        272,
        324,
        406,
        337,
        330,
        391,
        237,
        373,
        270,
        360,
        377,
        332,
        142,
        381,
        216
      ]
    }
  },
  "mon-allot": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 150,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 103,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 409,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 292,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 346,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 291,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 260,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 146,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 122,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 406,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 365,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 296,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T06:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 266,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T05:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 87,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 149,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 388,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 145,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 278,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T04:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 271,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T04:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 426,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 241,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 210,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T03:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 409,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T03:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 189,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T03:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 276,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T02:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 401,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T02:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 295,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T02:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 455,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T02:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 438,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 412,
        "error": null,
        "region": "Frankfurt"
      }
    ],
    "incidents": [],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        196,
        257,
        328,
        175,
        276,
        307,
        411,
        350,
        175,
        280,
        365,
        92,
        172,
        238,
        402,
        183,
        354,
        292,
        231,
        357,
        177,
        193,
        205,
        291,
        211,
        140,
        321,
        369,
        203,
        342,
        304,
        229,
        298,
        418,
        187,
        276,
        320,
        239,
        378,
        253,
        313,
        216,
        227,
        156,
        375,
        205,
        324,
        109
      ]
    }
  },
  "mon-parish": {
    "checks": [
      {
        "at": "2026-10-13T02:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 286,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T01:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 322,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 294,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 203,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 361,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T00:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 198,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T00:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 439,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T00:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 354,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T00:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 304,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-12T23:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 322,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T23:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 314,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-12T23:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 308,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T23:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 273,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T22:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 426,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-12T22:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 345,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T22:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 432,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T22:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 452,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-12T21:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 169,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-12T21:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 152,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-12T21:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 80,
        "error": null,
        "region": "Frankfurt"
      }
    ],
    "incidents": [],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        398,
        405,
        228,
        401,
        286,
        268,
        378,
        201,
        402,
        391,
        406,
        165,
        339,
        278,
        371,
        96,
        291,
        139,
        359,
        310,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ]
    }
  },
  "mon-field": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 110,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 334,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 228,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 100,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 151,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 255,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T07:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 270,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 141,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 173,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 409,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 424,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 281,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T06:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 424,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 248,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 82,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T05:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 88,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T05:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 106,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T04:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 372,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 327,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 397,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 294,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 378,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T03:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 333,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 84,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 264,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T02:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 285,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T02:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 403,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T02:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 322,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T02:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 172,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 137,
        "error": null,
        "region": "Dublin"
      }
    ],
    "incidents": [],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        384,
        301,
        225,
        360,
        296,
        96,
        351,
        294,
        403,
        180,
        368,
        377,
        233,
        400,
        198,
        258,
        228,
        327,
        358,
        308,
        414,
        190,
        294,
        363,
        371,
        318,
        381,
        209,
        127,
        234,
        415,
        261,
        329,
        337,
        96,
        109,
        300,
        153,
        362,
        192,
        354,
        340,
        261,
        245,
        278,
        128,
        295,
        221
      ]
    }
  },
  "mon-portfolio": {
    "checks": [
      {
        "at": "2026-10-13T09:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 377,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 340,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T08:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 244,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T08:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 236,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T08:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 178,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 114,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T07:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 450,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 226,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T07:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 261,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T06:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 418,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T06:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 131,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T06:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 152,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T06:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 298,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 198,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T05:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 239,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T05:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 173,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T05:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 399,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T04:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 393,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T04:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 85,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T04:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 321,
        "error": null,
        "region": "Dublin"
      },
      {
        "at": "2026-10-13T04:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 139,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 220,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T03:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 151,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T03:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 101,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T03:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 267,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T02:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 292,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T02:42:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 227,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T02:27:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 375,
        "error": null,
        "region": "Frankfurt"
      },
      {
        "at": "2026-10-13T02:12:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 452,
        "error": null,
        "region": "London"
      },
      {
        "at": "2026-10-13T01:57:00Z",
        "ok": true,
        "httpStatus": 200,
        "responseMs": 437,
        "error": null,
        "region": "Frankfurt"
      }
    ],
    "incidents": [],
    "responseTimes": {
      "bucket": "hour",
      "start": "2026-10-11T10:12:00Z",
      "counts": [
        263,
        322,
        97,
        95,
        402,
        148,
        374,
        274,
        107,
        317,
        157,
        398,
        214,
        261,
        108,
        273,
        179,
        189,
        111,
        343,
        135,
        240,
        167,
        294,
        402,
        268,
        132,
        222,
        414,
        295,
        248,
        127,
        103,
        214,
        128,
        269,
        348,
        307,
        406,
        224,
        185,
        373,
        168,
        236,
        368,
        358,
        163,
        284
      ]
    }
  }
}

/** Per monitor id: issues behind its open (or latest) incident, newest first. */
export const monitorRelatedIssues: Record<string, string[]> = {
  "mon-harbour": ["i-harbour-fetch", "i-68"]
}
