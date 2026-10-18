// Generated fixture — invented data with realistic shape.
import type { TimeRange } from "../src/contract/domain"
import type { OverviewPage } from "../src/contract/pages"
type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never

export const overviews: Record<TimeRange, Ready<OverviewPage>> = {
  "24h": {
    "range": "24h",
    "kpis": {
      "events": {
        "value": 2269,
        "previous": 703,
        "trend": [
          8,
          4,
          8,
          12,
          6,
          9,
          4,
          5,
          5,
          7,
          11,
          14
        ]
      },
      "newIssues": {
        "value": 5,
        "previous": 1,
        "trend": [
          3,
          1,
          3,
          4,
          2,
          3,
          1,
          2,
          2,
          2,
          4,
          3
        ]
      },
      "regressions": {
        "value": 1,
        "previous": 0,
        "trend": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1
        ]
      },
      "uptime": {
        "value": 97.84,
        "previous": 99.93,
        "trend": [
          100,
          100,
          99.9,
          100,
          100,
          100,
          99.8,
          100,
          100,
          100,
          99.6,
          97.8
        ]
      }
    },
    "projects": [
      {
        "client": "Harbour Dental Group",
        "url": "https://book.harbourdental.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-harbour",
        "id": "p-harbour",
        "key": "HARB",
        "name": "Harbour Dental bookings",
        "runtimes": [
          "browser",
          "server",
          "edge"
        ],
        "health": "down",
        "unresolvedIssues": 15,
        "events24h": 707,
        "lastEventAt": "2026-10-13T09:11:35Z"
      },
      {
        "client": "Mossgrove Hall",
        "url": "https://enquiries.mossgrovehall.co.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-moss",
        "id": "p-moss",
        "key": "MOSS",
        "name": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "regressed",
        "unresolvedIssues": 14,
        "events24h": 30,
        "lastEventAt": "2026-10-13T08:22:00Z"
      },
      {
        "client": "Kiln & Clay Ceramics Ltd",
        "url": "https://kilnandclay.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-kiln",
        "id": "p-kiln",
        "key": "KILN",
        "name": "Kiln & Clay",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 29,
        "events24h": 1514,
        "lastEventAt": "2026-10-13T09:11:20Z"
      },
      {
        "client": null,
        "url": "https://plot.sundial.dev",
        "environments": [
          "production",
          "development"
        ],
        "monitorId": "mon-allot",
        "id": "p-allot",
        "key": "ALOT",
        "name": "Allotment Planner",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 10,
        "events24h": 7,
        "lastEventAt": "2026-10-13T07:48:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-recipes",
        "key": "RCPE",
        "name": "Recipe box",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "awaiting_first_event",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      },
      {
        "client": null,
        "url": "https://tides.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-tides",
        "id": "p-tides",
        "key": "TIDE",
        "name": "tide-times-api",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 3,
        "events24h": 8,
        "lastEventAt": "2026-10-13T06:09:00Z"
      },
      {
        "client": "St Aidan's Church, Whitby",
        "url": "https://staidans-whitby.org.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-parish",
        "id": "p-parish",
        "key": "AIDN",
        "name": "St Aidan's newsletter",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 5,
        "events24h": 2,
        "lastEventAt": "2026-10-13T03:39:00Z"
      },
      {
        "client": null,
        "url": "https://fieldnotes.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-field",
        "id": "p-field",
        "key": "FLDN",
        "name": "fieldnotes",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 4,
        "events24h": 1,
        "lastEventAt": "2026-10-10T19:05:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-invoice",
        "key": "INVC",
        "name": "Invoice runner",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": "2026-10-10T15:36:00Z"
      },
      {
        "client": null,
        "url": "https://sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-portfolio",
        "id": "p-portfolio",
        "key": "SUND",
        "name": "sundial.dev",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      }
    ],
    "attention": [
      {
        "id": "i-moss-regressed",
        "shortId": "MOSS-24",
        "projectId": "p-moss",
        "type": "TypeError",
        "message": "Failed to fetch",
        "culprit": "components/EnquiryForm.tsx in submitEnquiry",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-09-02T09:12:00Z",
        "lastSeen": "2026-10-13T08:22:00Z",
        "eventCount": 46,
        "userCount": 17,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            2,
            3,
            1,
            2,
            1,
            1,
            1,
            2,
            2,
            1,
            3,
            2,
            2,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            2,
            1,
            1,
            2,
            2,
            1
          ]
        },
        "isNew": false,
        "isRegression": true
      },
      {
        "id": "i-hydration",
        "shortId": "KILN-Y",
        "projectId": "p-kiln",
        "type": "Error",
        "message": "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
        "culprit": "app/(shop)/products/[slug]/page.tsx",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T18:12:00Z",
        "lastSeen": "2026-10-13T09:03:00Z",
        "eventCount": 1290,
        "userCount": 797,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            802,
            488
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-harbour-fetch",
        "shortId": "HARB-1J",
        "projectId": "p-harbour",
        "type": "FetchError",
        "message": "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443",
        "culprit": "app/book/[practice]/slots/route.ts in GET",
        "level": "fatal",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-13T08:41:00Z",
        "lastSeen": "2026-10-13T09:11:35Z",
        "eventCount": 388,
        "userCount": 0,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            388
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-69",
        "shortId": "HARB-DS",
        "projectId": "p-harbour",
        "type": "TypeError",
        "message": "Failed to construct 'URL': Invalid URL",
        "culprit": "lib/links.ts in absoluteUrl",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-09T09:12:00Z",
        "lastSeen": "2026-10-12T10:11:00Z",
        "eventCount": 488,
        "userCount": 127,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            128,
            60,
            120,
            88,
            93
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-cart-map",
        "shortId": "KILN-R",
        "projectId": "p-kiln",
        "type": "TypeError",
        "message": "Cannot read properties of undefined (reading 'map')",
        "culprit": "components/cart/CartDrawer.tsx in CartDrawer",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        },
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T09:09:00Z",
        "eventCount": 212,
        "userCount": 87,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            141,
            71
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-4",
        "shortId": "KILN-15",
        "projectId": "p-kiln",
        "type": "ChunkLoadError",
        "message": "Loading chunk 8271 failed.\n(error: https://kilnandclay.co.uk/_next/static/chunks/8271-a4c1f0e9b2d37f10.js)",
        "culprit": "webpack/runtime/jsonp chunk loading",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T07:12:00Z",
        "eventCount": 64,
        "userCount": 27,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            64
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-15",
        "shortId": "ALOT-3A",
        "projectId": "p-allot",
        "type": "RangeError",
        "message": "Invalid time value",
        "culprit": "lib/calendar/formatSowingWindow.ts in formatSowingWindow",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T13:12:00Z",
        "lastSeen": "2026-10-13T05:12:00Z",
        "eventCount": 5,
        "userCount": 2,
        "environments": [
          "production",
          "development"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            5
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-longest",
        "shortId": "MOSS-2B",
        "projectId": "p-moss",
        "type": "ValidationError",
        "message": "enquiry.guestCount must be a whole number between 1 and 250 but received \"around 120 maybe 140 depending on whether the evening guests are included, will confirm with my partner and her mum this weekend\" (field: guests, form: wedding-enquiry-v2, step 3 of 4, locale: en-GB)",
        "culprit": "lib/forms/wedding-enquiry/validateStepThree.ts in parseGuestCount",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-10T09:12:00Z",
        "lastSeen": "2026-10-13T04:12:00Z",
        "eventCount": 11,
        "userCount": 5,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            4,
            2,
            3,
            2
          ]
        },
        "isNew": true,
        "isRegression": false
      }
    ],
    "events": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "byLevel": {
        "fatal": [
          4,
          11,
          7,
          12,
          8,
          6,
          11,
          5,
          4,
          7,
          4,
          4,
          11,
          10,
          6,
          11,
          5,
          11,
          6,
          null,
          null,
          10,
          4,
          9,
          10,
          9,
          5,
          9,
          9,
          392
        ],
        "error": [
          201,
          160,
          128,
          156,
          181,
          191,
          186,
          247,
          273,
          249,
          257,
          273,
          319,
          204,
          254,
          253,
          312,
          222,
          294,
          null,
          null,
          467,
          507,
          491,
          463,
          584,
          564,
          568,
          1499,
          1306
        ],
        "warning": [
          502,
          889,
          408,
          548,
          460,
          840,
          354,
          920,
          608,
          568,
          872,
          935,
          822,
          762,
          910,
          1123,
          495,
          1011,
          481,
          null,
          null,
          787,
          1001,
          741,
          793,
          536,
          941,
          689,
          742,
          571
        ]
      }
    },
    "releases": [
      {
        "id": "r-kiln-0",
        "projectId": "p-kiln",
        "version": "2026.10.12-1",
        "environment": "production",
        "deployedAt": "2026-10-12T16:42:00Z",
        "commit": {
          "sha": "6fc0d3007bec4f2d2de69b36876ed56b0733c86f",
          "message": "Bump deps",
          "author": "Charles"
        },
        "newIssues": 2,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 5387
      },
      {
        "id": "r-kiln-1",
        "projectId": "p-kiln",
        "version": "2026.10.11-2",
        "environment": "production",
        "deployedAt": "2026-10-10T23:54:00Z",
        "commit": {
          "sha": "66343081402db95dea1845fcaf36ead061c9770b",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 6036
      },
      {
        "id": "r-kiln-2",
        "projectId": "p-kiln",
        "version": "2026.10.9-3",
        "environment": "production",
        "deployedAt": "2026-10-09T07:06:00Z",
        "commit": {
          "sha": "531a971b11fe658341a656d4c9a64062597243a1",
          "message": "Fix cart drawer when basket empties mid-checkout",
          "author": "Priya Natarajan"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8344
      },
      {
        "id": "r-kiln-3",
        "projectId": "p-kiln",
        "version": "2026.10.8-1",
        "environment": "production",
        "deployedAt": "2026-10-07T14:18:00Z",
        "commit": {
          "sha": "9750dc2cf1e403bc2f97b0f3e334360b21463244",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 4460
      },
      {
        "id": "r-harbour-0",
        "projectId": "p-harbour",
        "version": "v2.14.0",
        "environment": "production",
        "deployedAt": "2026-10-11T09:12:00Z",
        "commit": {
          "sha": "77f7d504e3b7fbee7e136ce8d225c8ae46af5d91",
          "message": "Speed up slot search by caching practice availability for 60s",
          "author": "Charles"
        },
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 1062
      },
      {
        "id": "r-harbour-1",
        "projectId": "p-harbour",
        "version": "v2.13.0",
        "environment": "production",
        "deployedAt": "2026-10-07T09:12:00Z",
        "commit": {
          "sha": "bb85bd8f725fe655f1cc46fbd702503f453285f7",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 1081
      },
      {
        "id": "r-moss-0",
        "projectId": "p-moss",
        "version": "v3.8.1",
        "environment": "production",
        "deployedAt": "2026-10-10T09:12:00Z",
        "commit": {
          "sha": "6f49c562959f60fc94ede1777b641fa10d22e3e1",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 1,
        "quietSinceDeploy": 2,
        "eventCount": 35
      },
      {
        "id": "r-allot-0",
        "projectId": "p-allot",
        "version": "27a7795",
        "environment": "production",
        "deployedAt": "2026-10-12T04:24:00Z",
        "commit": null,
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 9
      },
      {
        "id": "r-allot-1",
        "projectId": "p-allot",
        "version": "4ca9c53",
        "environment": "production",
        "deployedAt": "2026-10-09T04:24:00Z",
        "commit": {
          "sha": "224b53e69fd1dae449ae8bd10528720a401b3394",
          "message": "Enquiry form: allow ranges for guest count",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8
      },
      {
        "id": "r-portfolio-0",
        "projectId": "p-portfolio",
        "version": "37728ef",
        "environment": "production",
        "deployedAt": "2026-10-08T09:12:00Z",
        "commit": {
          "sha": "a16be86f3f9869713a17e7b589dd12aff1e056e5",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 0
      }
    ],
    "monitorsDown": [
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
      }
    ]
  },
  "7d": {
    "range": "7d",
    "kpis": {
      "events": {
        "value": 10931,
        "previous": 8089,
        "trend": [
          11,
          10,
          11,
          2,
          4,
          8,
          7,
          7,
          8,
          2,
          6,
          14
        ]
      },
      "newIssues": {
        "value": 14,
        "previous": 10,
        "trend": [
          4,
          3,
          4,
          1,
          1,
          3,
          2,
          2,
          3,
          1,
          2,
          3
        ]
      },
      "regressions": {
        "value": 1,
        "previous": 0,
        "trend": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1
        ]
      },
      "uptime": {
        "value": 99.52,
        "previous": 99.93,
        "trend": [
          100,
          100,
          99.9,
          100,
          100,
          100,
          99.8,
          100,
          100,
          100,
          99.6,
          97.8
        ]
      }
    },
    "projects": [
      {
        "client": "Harbour Dental Group",
        "url": "https://book.harbourdental.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-harbour",
        "id": "p-harbour",
        "key": "HARB",
        "name": "Harbour Dental bookings",
        "runtimes": [
          "browser",
          "server",
          "edge"
        ],
        "health": "down",
        "unresolvedIssues": 15,
        "events24h": 707,
        "lastEventAt": "2026-10-13T09:11:35Z"
      },
      {
        "client": "Mossgrove Hall",
        "url": "https://enquiries.mossgrovehall.co.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-moss",
        "id": "p-moss",
        "key": "MOSS",
        "name": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "regressed",
        "unresolvedIssues": 14,
        "events24h": 30,
        "lastEventAt": "2026-10-13T08:22:00Z"
      },
      {
        "client": "Kiln & Clay Ceramics Ltd",
        "url": "https://kilnandclay.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-kiln",
        "id": "p-kiln",
        "key": "KILN",
        "name": "Kiln & Clay",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 29,
        "events24h": 1514,
        "lastEventAt": "2026-10-13T09:11:20Z"
      },
      {
        "client": null,
        "url": "https://plot.sundial.dev",
        "environments": [
          "production",
          "development"
        ],
        "monitorId": "mon-allot",
        "id": "p-allot",
        "key": "ALOT",
        "name": "Allotment Planner",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 10,
        "events24h": 7,
        "lastEventAt": "2026-10-13T07:48:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-recipes",
        "key": "RCPE",
        "name": "Recipe box",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "awaiting_first_event",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      },
      {
        "client": null,
        "url": "https://tides.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-tides",
        "id": "p-tides",
        "key": "TIDE",
        "name": "tide-times-api",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 3,
        "events24h": 8,
        "lastEventAt": "2026-10-13T06:09:00Z"
      },
      {
        "client": "St Aidan's Church, Whitby",
        "url": "https://staidans-whitby.org.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-parish",
        "id": "p-parish",
        "key": "AIDN",
        "name": "St Aidan's newsletter",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 5,
        "events24h": 2,
        "lastEventAt": "2026-10-13T03:39:00Z"
      },
      {
        "client": null,
        "url": "https://fieldnotes.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-field",
        "id": "p-field",
        "key": "FLDN",
        "name": "fieldnotes",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 4,
        "events24h": 1,
        "lastEventAt": "2026-10-10T19:05:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-invoice",
        "key": "INVC",
        "name": "Invoice runner",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": "2026-10-10T15:36:00Z"
      },
      {
        "client": null,
        "url": "https://sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-portfolio",
        "id": "p-portfolio",
        "key": "SUND",
        "name": "sundial.dev",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      }
    ],
    "attention": [
      {
        "id": "i-moss-regressed",
        "shortId": "MOSS-24",
        "projectId": "p-moss",
        "type": "TypeError",
        "message": "Failed to fetch",
        "culprit": "components/EnquiryForm.tsx in submitEnquiry",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-09-02T09:12:00Z",
        "lastSeen": "2026-10-13T08:22:00Z",
        "eventCount": 46,
        "userCount": 17,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            2,
            3,
            1,
            2,
            1,
            1,
            1,
            2,
            2,
            1,
            3,
            2,
            2,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            2,
            1,
            1,
            2,
            2,
            1
          ]
        },
        "isNew": false,
        "isRegression": true
      },
      {
        "id": "i-hydration",
        "shortId": "KILN-Y",
        "projectId": "p-kiln",
        "type": "Error",
        "message": "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
        "culprit": "app/(shop)/products/[slug]/page.tsx",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T18:12:00Z",
        "lastSeen": "2026-10-13T09:03:00Z",
        "eventCount": 1290,
        "userCount": 797,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            802,
            488
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-69",
        "shortId": "HARB-DS",
        "projectId": "p-harbour",
        "type": "TypeError",
        "message": "Failed to construct 'URL': Invalid URL",
        "culprit": "lib/links.ts in absoluteUrl",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-09T09:12:00Z",
        "lastSeen": "2026-10-12T10:11:00Z",
        "eventCount": 488,
        "userCount": 127,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            128,
            60,
            120,
            88,
            93
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-harbour-fetch",
        "shortId": "HARB-1J",
        "projectId": "p-harbour",
        "type": "FetchError",
        "message": "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443",
        "culprit": "app/book/[practice]/slots/route.ts in GET",
        "level": "fatal",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-13T08:41:00Z",
        "lastSeen": "2026-10-13T09:11:35Z",
        "eventCount": 388,
        "userCount": 0,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            388
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-cart-map",
        "shortId": "KILN-R",
        "projectId": "p-kiln",
        "type": "TypeError",
        "message": "Cannot read properties of undefined (reading 'map')",
        "culprit": "components/cart/CartDrawer.tsx in CartDrawer",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        },
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T09:09:00Z",
        "eventCount": 212,
        "userCount": 87,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            141,
            71
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-4",
        "shortId": "KILN-15",
        "projectId": "p-kiln",
        "type": "ChunkLoadError",
        "message": "Loading chunk 8271 failed.\n(error: https://kilnandclay.co.uk/_next/static/chunks/8271-a4c1f0e9b2d37f10.js)",
        "culprit": "webpack/runtime/jsonp chunk loading",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T07:12:00Z",
        "eventCount": 64,
        "userCount": 27,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            64
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-72",
        "shortId": "MOSS-ED",
        "projectId": "p-moss",
        "type": "SyntaxError",
        "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
        "culprit": "lib/api/client.ts in parseJson",
        "level": "warning",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-08T09:12:00Z",
        "lastSeen": "2026-10-08T09:12:00Z",
        "eventCount": 59,
        "userCount": 23,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            10,
            8,
            10,
            8,
            11,
            12
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-73",
        "shortId": "MOSS-EK",
        "projectId": "p-moss",
        "type": "Error",
        "message": "Invalid postcode: \"YO21 3\"",
        "culprit": "lib/shipping/validatePostcode.ts",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-07T09:12:00Z",
        "lastSeen": "2026-10-11T07:51:00Z",
        "eventCount": 46,
        "userCount": 16,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            9,
            9,
            3,
            4,
            7,
            5,
            9
          ]
        },
        "isNew": true,
        "isRegression": false
      }
    ],
    "events": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "byLevel": {
        "fatal": [
          4,
          11,
          7,
          12,
          8,
          6,
          11,
          5,
          4,
          7,
          4,
          4,
          11,
          10,
          6,
          11,
          5,
          11,
          6,
          null,
          null,
          10,
          4,
          9,
          10,
          9,
          5,
          9,
          9,
          392
        ],
        "error": [
          201,
          160,
          128,
          156,
          181,
          191,
          186,
          247,
          273,
          249,
          257,
          273,
          319,
          204,
          254,
          253,
          312,
          222,
          294,
          null,
          null,
          467,
          507,
          491,
          463,
          584,
          564,
          568,
          1499,
          1306
        ],
        "warning": [
          502,
          889,
          408,
          548,
          460,
          840,
          354,
          920,
          608,
          568,
          872,
          935,
          822,
          762,
          910,
          1123,
          495,
          1011,
          481,
          null,
          null,
          787,
          1001,
          741,
          793,
          536,
          941,
          689,
          742,
          571
        ]
      }
    },
    "releases": [
      {
        "id": "r-kiln-0",
        "projectId": "p-kiln",
        "version": "2026.10.12-1",
        "environment": "production",
        "deployedAt": "2026-10-12T16:42:00Z",
        "commit": {
          "sha": "6fc0d3007bec4f2d2de69b36876ed56b0733c86f",
          "message": "Bump deps",
          "author": "Charles"
        },
        "newIssues": 2,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 5387
      },
      {
        "id": "r-kiln-1",
        "projectId": "p-kiln",
        "version": "2026.10.11-2",
        "environment": "production",
        "deployedAt": "2026-10-10T23:54:00Z",
        "commit": {
          "sha": "66343081402db95dea1845fcaf36ead061c9770b",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 6036
      },
      {
        "id": "r-kiln-2",
        "projectId": "p-kiln",
        "version": "2026.10.9-3",
        "environment": "production",
        "deployedAt": "2026-10-09T07:06:00Z",
        "commit": {
          "sha": "531a971b11fe658341a656d4c9a64062597243a1",
          "message": "Fix cart drawer when basket empties mid-checkout",
          "author": "Priya Natarajan"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8344
      },
      {
        "id": "r-kiln-3",
        "projectId": "p-kiln",
        "version": "2026.10.8-1",
        "environment": "production",
        "deployedAt": "2026-10-07T14:18:00Z",
        "commit": {
          "sha": "9750dc2cf1e403bc2f97b0f3e334360b21463244",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 4460
      },
      {
        "id": "r-harbour-0",
        "projectId": "p-harbour",
        "version": "v2.14.0",
        "environment": "production",
        "deployedAt": "2026-10-11T09:12:00Z",
        "commit": {
          "sha": "77f7d504e3b7fbee7e136ce8d225c8ae46af5d91",
          "message": "Speed up slot search by caching practice availability for 60s",
          "author": "Charles"
        },
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 1062
      },
      {
        "id": "r-harbour-1",
        "projectId": "p-harbour",
        "version": "v2.13.0",
        "environment": "production",
        "deployedAt": "2026-10-07T09:12:00Z",
        "commit": {
          "sha": "bb85bd8f725fe655f1cc46fbd702503f453285f7",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 1081
      },
      {
        "id": "r-moss-0",
        "projectId": "p-moss",
        "version": "v3.8.1",
        "environment": "production",
        "deployedAt": "2026-10-10T09:12:00Z",
        "commit": {
          "sha": "6f49c562959f60fc94ede1777b641fa10d22e3e1",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 1,
        "quietSinceDeploy": 2,
        "eventCount": 35
      },
      {
        "id": "r-allot-0",
        "projectId": "p-allot",
        "version": "27a7795",
        "environment": "production",
        "deployedAt": "2026-10-12T04:24:00Z",
        "commit": null,
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 9
      },
      {
        "id": "r-allot-1",
        "projectId": "p-allot",
        "version": "4ca9c53",
        "environment": "production",
        "deployedAt": "2026-10-09T04:24:00Z",
        "commit": {
          "sha": "224b53e69fd1dae449ae8bd10528720a401b3394",
          "message": "Enquiry form: allow ranges for guest count",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8
      },
      {
        "id": "r-portfolio-0",
        "projectId": "p-portfolio",
        "version": "37728ef",
        "environment": "production",
        "deployedAt": "2026-10-08T09:12:00Z",
        "commit": {
          "sha": "a16be86f3f9869713a17e7b589dd12aff1e056e5",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 0
      }
    ],
    "monitorsDown": [
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
      }
    ]
  },
  "30d": {
    "range": "30d",
    "kpis": {
      "events": {
        "value": 31718,
        "previous": 23471,
        "trend": [
          12,
          2,
          3,
          9,
          3,
          9,
          8,
          9,
          7,
          10,
          7,
          14
        ]
      },
      "newIssues": {
        "value": 56,
        "previous": 52,
        "trend": [
          4,
          1,
          1,
          3,
          1,
          3,
          3,
          3,
          2,
          3,
          2,
          3
        ]
      },
      "regressions": {
        "value": 1,
        "previous": 0,
        "trend": [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1
        ]
      },
      "uptime": {
        "value": 99.71,
        "previous": 99.93,
        "trend": [
          100,
          100,
          99.9,
          100,
          100,
          100,
          99.8,
          100,
          100,
          100,
          99.6,
          97.8
        ]
      }
    },
    "projects": [
      {
        "client": "Harbour Dental Group",
        "url": "https://book.harbourdental.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-harbour",
        "id": "p-harbour",
        "key": "HARB",
        "name": "Harbour Dental bookings",
        "runtimes": [
          "browser",
          "server",
          "edge"
        ],
        "health": "down",
        "unresolvedIssues": 15,
        "events24h": 707,
        "lastEventAt": "2026-10-13T09:11:35Z"
      },
      {
        "client": "Mossgrove Hall",
        "url": "https://enquiries.mossgrovehall.co.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-moss",
        "id": "p-moss",
        "key": "MOSS",
        "name": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "regressed",
        "unresolvedIssues": 14,
        "events24h": 30,
        "lastEventAt": "2026-10-13T08:22:00Z"
      },
      {
        "client": "Kiln & Clay Ceramics Ltd",
        "url": "https://kilnandclay.co.uk",
        "environments": [
          "production",
          "staging"
        ],
        "monitorId": "mon-kiln",
        "id": "p-kiln",
        "key": "KILN",
        "name": "Kiln & Clay",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 29,
        "events24h": 1514,
        "lastEventAt": "2026-10-13T09:11:20Z"
      },
      {
        "client": null,
        "url": "https://plot.sundial.dev",
        "environments": [
          "production",
          "development"
        ],
        "monitorId": "mon-allot",
        "id": "p-allot",
        "key": "ALOT",
        "name": "Allotment Planner",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "new_issues",
        "unresolvedIssues": 10,
        "events24h": 7,
        "lastEventAt": "2026-10-13T07:48:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-recipes",
        "key": "RCPE",
        "name": "Recipe box",
        "runtimes": [
          "browser",
          "server"
        ],
        "health": "awaiting_first_event",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      },
      {
        "client": null,
        "url": "https://tides.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-tides",
        "id": "p-tides",
        "key": "TIDE",
        "name": "tide-times-api",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 3,
        "events24h": 8,
        "lastEventAt": "2026-10-13T06:09:00Z"
      },
      {
        "client": "St Aidan's Church, Whitby",
        "url": "https://staidans-whitby.org.uk",
        "environments": [
          "production"
        ],
        "monitorId": "mon-parish",
        "id": "p-parish",
        "key": "AIDN",
        "name": "St Aidan's newsletter",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 5,
        "events24h": 2,
        "lastEventAt": "2026-10-13T03:39:00Z"
      },
      {
        "client": null,
        "url": "https://fieldnotes.sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-field",
        "id": "p-field",
        "key": "FLDN",
        "name": "fieldnotes",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 4,
        "events24h": 1,
        "lastEventAt": "2026-10-10T19:05:00Z"
      },
      {
        "client": null,
        "url": null,
        "environments": [
          "production"
        ],
        "monitorId": null,
        "id": "p-invoice",
        "key": "INVC",
        "name": "Invoice runner",
        "runtimes": [
          "server"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": "2026-10-10T15:36:00Z"
      },
      {
        "client": null,
        "url": "https://sundial.dev",
        "environments": [
          "production"
        ],
        "monitorId": "mon-portfolio",
        "id": "p-portfolio",
        "key": "SUND",
        "name": "sundial.dev",
        "runtimes": [
          "browser"
        ],
        "health": "healthy",
        "unresolvedIssues": 0,
        "events24h": 0,
        "lastEventAt": null
      }
    ],
    "attention": [
      {
        "id": "i-moss-regressed",
        "shortId": "MOSS-24",
        "projectId": "p-moss",
        "type": "TypeError",
        "message": "Failed to fetch",
        "culprit": "components/EnquiryForm.tsx in submitEnquiry",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-09-02T09:12:00Z",
        "lastSeen": "2026-10-13T08:22:00Z",
        "eventCount": 46,
        "userCount": 17,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            2,
            3,
            1,
            2,
            1,
            1,
            1,
            2,
            2,
            1,
            3,
            2,
            2,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            1,
            1,
            2,
            1,
            2,
            1,
            1,
            2,
            2,
            1
          ]
        },
        "isNew": false,
        "isRegression": true
      },
      {
        "id": "i-hydration",
        "shortId": "KILN-Y",
        "projectId": "p-kiln",
        "type": "Error",
        "message": "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
        "culprit": "app/(shop)/products/[slug]/page.tsx",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T18:12:00Z",
        "lastSeen": "2026-10-13T09:03:00Z",
        "eventCount": 1290,
        "userCount": 797,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            802,
            488
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-69",
        "shortId": "HARB-DS",
        "projectId": "p-harbour",
        "type": "TypeError",
        "message": "Failed to construct 'URL': Invalid URL",
        "culprit": "lib/links.ts in absoluteUrl",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-09T09:12:00Z",
        "lastSeen": "2026-10-12T10:11:00Z",
        "eventCount": 488,
        "userCount": 127,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            128,
            60,
            120,
            88,
            93
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-harbour-fetch",
        "shortId": "HARB-1J",
        "projectId": "p-harbour",
        "type": "FetchError",
        "message": "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443",
        "culprit": "app/book/[practice]/slots/route.ts in GET",
        "level": "fatal",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-13T08:41:00Z",
        "lastSeen": "2026-10-13T09:11:35Z",
        "eventCount": 388,
        "userCount": 0,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            388
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-cart-map",
        "shortId": "KILN-R",
        "projectId": "p-kiln",
        "type": "TypeError",
        "message": "Cannot read properties of undefined (reading 'map')",
        "culprit": "components/cart/CartDrawer.tsx in CartDrawer",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        },
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T09:09:00Z",
        "eventCount": 212,
        "userCount": 87,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            141,
            71
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-4",
        "shortId": "KILN-15",
        "projectId": "p-kiln",
        "type": "ChunkLoadError",
        "message": "Loading chunk 8271 failed.\n(error: https://kilnandclay.co.uk/_next/static/chunks/8271-a4c1f0e9b2d37f10.js)",
        "culprit": "webpack/runtime/jsonp chunk loading",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-12T17:12:00Z",
        "lastSeen": "2026-10-13T07:12:00Z",
        "eventCount": 64,
        "userCount": 27,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            64
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-72",
        "shortId": "MOSS-ED",
        "projectId": "p-moss",
        "type": "SyntaxError",
        "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
        "culprit": "lib/api/client.ts in parseJson",
        "level": "warning",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-08T09:12:00Z",
        "lastSeen": "2026-10-08T09:12:00Z",
        "eventCount": 59,
        "userCount": 23,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            10,
            8,
            10,
            8,
            11,
            12
          ]
        },
        "isNew": true,
        "isRegression": false
      },
      {
        "id": "i-73",
        "shortId": "MOSS-EK",
        "projectId": "p-moss",
        "type": "Error",
        "message": "Invalid postcode: \"YO21 3\"",
        "culprit": "lib/shipping/validatePostcode.ts",
        "level": "error",
        "status": "unresolved",
        "snooze": null,
        "assignee": null,
        "firstSeen": "2026-10-07T09:12:00Z",
        "lastSeen": "2026-10-11T07:51:00Z",
        "eventCount": 46,
        "userCount": 16,
        "environments": [
          "production"
        ],
        "trend": {
          "bucket": "day",
          "start": "2026-09-14T00:00:00Z",
          "counts": [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            9,
            9,
            3,
            4,
            7,
            5,
            9
          ]
        },
        "isNew": true,
        "isRegression": false
      }
    ],
    "events": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "byLevel": {
        "fatal": [
          4,
          11,
          7,
          12,
          8,
          6,
          11,
          5,
          4,
          7,
          4,
          4,
          11,
          10,
          6,
          11,
          5,
          11,
          6,
          null,
          null,
          10,
          4,
          9,
          10,
          9,
          5,
          9,
          9,
          392
        ],
        "error": [
          201,
          160,
          128,
          156,
          181,
          191,
          186,
          247,
          273,
          249,
          257,
          273,
          319,
          204,
          254,
          253,
          312,
          222,
          294,
          null,
          null,
          467,
          507,
          491,
          463,
          584,
          564,
          568,
          1499,
          1306
        ],
        "warning": [
          502,
          889,
          408,
          548,
          460,
          840,
          354,
          920,
          608,
          568,
          872,
          935,
          822,
          762,
          910,
          1123,
          495,
          1011,
          481,
          null,
          null,
          787,
          1001,
          741,
          793,
          536,
          941,
          689,
          742,
          571
        ]
      }
    },
    "releases": [
      {
        "id": "r-kiln-0",
        "projectId": "p-kiln",
        "version": "2026.10.12-1",
        "environment": "production",
        "deployedAt": "2026-10-12T16:42:00Z",
        "commit": {
          "sha": "6fc0d3007bec4f2d2de69b36876ed56b0733c86f",
          "message": "Bump deps",
          "author": "Charles"
        },
        "newIssues": 2,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 5387
      },
      {
        "id": "r-kiln-1",
        "projectId": "p-kiln",
        "version": "2026.10.11-2",
        "environment": "production",
        "deployedAt": "2026-10-10T23:54:00Z",
        "commit": {
          "sha": "66343081402db95dea1845fcaf36ead061c9770b",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 6036
      },
      {
        "id": "r-kiln-2",
        "projectId": "p-kiln",
        "version": "2026.10.9-3",
        "environment": "production",
        "deployedAt": "2026-10-09T07:06:00Z",
        "commit": {
          "sha": "531a971b11fe658341a656d4c9a64062597243a1",
          "message": "Fix cart drawer when basket empties mid-checkout",
          "author": "Priya Natarajan"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8344
      },
      {
        "id": "r-kiln-3",
        "projectId": "p-kiln",
        "version": "2026.10.8-1",
        "environment": "production",
        "deployedAt": "2026-10-07T14:18:00Z",
        "commit": {
          "sha": "9750dc2cf1e403bc2f97b0f3e334360b21463244",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 4460
      },
      {
        "id": "r-kiln-4",
        "projectId": "p-kiln",
        "version": "2026.10.6-2",
        "environment": "production",
        "deployedAt": "2026-10-05T21:30:00Z",
        "commit": {
          "sha": "e2973599660673bfc4001d4aebe6e78509e20b58",
          "message": "Fix timezone bug in sowing calendar",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 7791
      },
      {
        "id": "r-kiln-5",
        "projectId": "p-kiln",
        "version": "2026.10.4-3",
        "environment": "production",
        "deployedAt": "2026-10-04T04:42:00Z",
        "commit": {
          "sha": "03828dea46dfd2784d05179ef712c74cb9ff4eb1",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 3674
      },
      {
        "id": "r-kiln-6",
        "projectId": "p-kiln",
        "version": "2026.10.3-1",
        "environment": "production",
        "deployedAt": "2026-10-02T11:54:00Z",
        "commit": null,
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 6413
      },
      {
        "id": "r-kiln-7",
        "projectId": "p-kiln",
        "version": "2026.10.1-2",
        "environment": "production",
        "deployedAt": "2026-09-30T19:06:00Z",
        "commit": {
          "sha": "b143443884c8ab476b52ae4f2be5403bdec40165",
          "message": "wip",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 3852
      },
      {
        "id": "r-kiln-8",
        "projectId": "p-kiln",
        "version": "2026.10.0-3",
        "environment": "production",
        "deployedAt": "2026-09-29T02:18:00Z",
        "commit": {
          "sha": "68294d7e6d472e78bf08e1a4c604eb0f936cd814",
          "message": "Speed up slot search by caching practice availability for 60s",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 4571
      },
      {
        "id": "r-harbour-0",
        "projectId": "p-harbour",
        "version": "v2.14.0",
        "environment": "production",
        "deployedAt": "2026-10-11T09:12:00Z",
        "commit": {
          "sha": "77f7d504e3b7fbee7e136ce8d225c8ae46af5d91",
          "message": "Speed up slot search by caching practice availability for 60s",
          "author": "Charles"
        },
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 1062
      },
      {
        "id": "r-harbour-1",
        "projectId": "p-harbour",
        "version": "v2.13.0",
        "environment": "production",
        "deployedAt": "2026-10-07T09:12:00Z",
        "commit": {
          "sha": "bb85bd8f725fe655f1cc46fbd702503f453285f7",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 1081
      },
      {
        "id": "r-harbour-2",
        "projectId": "p-harbour",
        "version": "v2.12.0",
        "environment": "production",
        "deployedAt": "2026-10-03T09:12:00Z",
        "commit": {
          "sha": "80cb313444120fddbdcc6885a11728052724445e",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 568
      },
      {
        "id": "r-harbour-3",
        "projectId": "p-harbour",
        "version": "v2.11.0",
        "environment": "production",
        "deployedAt": "2026-09-29T09:12:00Z",
        "commit": {
          "sha": "19c433baa33161ef32fa84e415ab0f5aed7e3bc2",
          "message": "Fix timezone bug in sowing calendar",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 854
      },
      {
        "id": "r-harbour-4",
        "projectId": "p-harbour",
        "version": "v2.10.0",
        "environment": "production",
        "deployedAt": "2026-09-25T09:12:00Z",
        "commit": {
          "sha": "1fac514fa3a963b939cc981496397cfc4eee4d5d",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 800
      },
      {
        "id": "r-harbour-5",
        "projectId": "p-harbour",
        "version": "v2.9.0",
        "environment": "production",
        "deployedAt": "2026-09-21T09:12:00Z",
        "commit": null,
        "newIssues": 20,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 483
      },
      {
        "id": "r-moss-0",
        "projectId": "p-moss",
        "version": "v3.8.1",
        "environment": "production",
        "deployedAt": "2026-10-10T09:12:00Z",
        "commit": {
          "sha": "6f49c562959f60fc94ede1777b641fa10d22e3e1",
          "message": "Copy changes from Fiona",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 1,
        "quietSinceDeploy": 2,
        "eventCount": 35
      },
      {
        "id": "r-moss-1",
        "projectId": "p-moss",
        "version": "v3.8.0",
        "environment": "production",
        "deployedAt": "2026-10-04T09:12:00Z",
        "commit": {
          "sha": "e95ff75b0359f478748b02e3c5349b1230481595",
          "message": "Handle upstream 503 from station feed with retry and backoff instead of failing the whole request",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 51
      },
      {
        "id": "r-moss-2",
        "projectId": "p-moss",
        "version": "v3.7.2",
        "environment": "production",
        "deployedAt": "2026-09-28T09:12:00Z",
        "commit": {
          "sha": "5deb864732df27cec34df6505f70daec51fa4cdc",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 65
      },
      {
        "id": "r-moss-3",
        "projectId": "p-moss",
        "version": "v3.7.1",
        "environment": "production",
        "deployedAt": "2026-09-22T09:12:00Z",
        "commit": {
          "sha": "17cccdeb0571802a907d051e45601c03cbd8dbca",
          "message": "Move product pages to the new image component",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 50
      },
      {
        "id": "r-moss-4",
        "projectId": "p-moss",
        "version": "v3.6.0",
        "environment": "production",
        "deployedAt": "2026-09-16T09:12:00Z",
        "commit": {
          "sha": "1f937739e79c8915a16e3682db4af3ded922ddd0",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 19,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 19
      },
      {
        "id": "r-tides-0",
        "projectId": "p-tides",
        "version": "ca4fda5",
        "environment": "production",
        "deployedAt": "2026-10-05T09:12:00Z",
        "commit": {
          "sha": "5ceaca459effbb0c03785ef44e4b7aa2cdafef7e",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 20
      },
      {
        "id": "r-tides-1",
        "projectId": "p-tides",
        "version": "ac64da3",
        "environment": "production",
        "deployedAt": "2026-09-26T09:12:00Z",
        "commit": {
          "sha": "b4d6524584e23e28d51fee54a5e644e47f7adeae",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 21
      },
      {
        "id": "r-tides-2",
        "projectId": "p-tides",
        "version": "4c94515",
        "environment": "production",
        "deployedAt": "2026-09-17T09:12:00Z",
        "commit": {
          "sha": "2c67f048bb7891e12d4662e711c4c69252f0ecb4",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 5
      },
      {
        "id": "r-allot-0",
        "projectId": "p-allot",
        "version": "27a7795",
        "environment": "production",
        "deployedAt": "2026-10-12T04:24:00Z",
        "commit": null,
        "newIssues": 1,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 9
      },
      {
        "id": "r-allot-1",
        "projectId": "p-allot",
        "version": "4ca9c53",
        "environment": "production",
        "deployedAt": "2026-10-09T04:24:00Z",
        "commit": {
          "sha": "224b53e69fd1dae449ae8bd10528720a401b3394",
          "message": "Enquiry form: allow ranges for guest count",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 8
      },
      {
        "id": "r-allot-2",
        "projectId": "p-allot",
        "version": "2fd10a5",
        "environment": "production",
        "deployedAt": "2026-10-06T04:24:00Z",
        "commit": {
          "sha": "5ef4a85242479b3e3a17ee64ca46a7a4829d6be8",
          "message": "Revert \"Speed up slot search\"",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 16
      },
      {
        "id": "r-allot-3",
        "projectId": "p-allot",
        "version": "6130aca",
        "environment": "production",
        "deployedAt": "2026-10-03T04:24:00Z",
        "commit": {
          "sha": "025a0596b6a199b1b75c957d7671d133992fb203",
          "message": "Speed up slot search by caching practice availability for 60s",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 9
      },
      {
        "id": "r-allot-4",
        "projectId": "p-allot",
        "version": "8f806b2",
        "environment": "production",
        "deployedAt": "2026-09-30T04:24:00Z",
        "commit": {
          "sha": "f22b656ebae2411f27bff77a3705e3f1f272c78d",
          "message": "Enquiry form: allow ranges for guest count",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 20
      },
      {
        "id": "r-allot-5",
        "projectId": "p-allot",
        "version": "17e88cb",
        "environment": "production",
        "deployedAt": "2026-09-27T04:24:00Z",
        "commit": null,
        "newIssues": 12,
        "regressedIssues": 0,
        "quietSinceDeploy": 2,
        "eventCount": 8
      },
      {
        "id": "r-parish-0",
        "projectId": "p-parish",
        "version": "1.4.0",
        "environment": "production",
        "deployedAt": "2026-09-21T09:12:00Z",
        "commit": null,
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 4
      },
      {
        "id": "r-field-0",
        "projectId": "p-field",
        "version": "8cddf58",
        "environment": "production",
        "deployedAt": "2026-10-04T09:12:00Z",
        "commit": {
          "sha": "3254aca2df5854af4993bc6e93af5817b8da0752",
          "message": "wip",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 2
      },
      {
        "id": "r-field-1",
        "projectId": "p-field",
        "version": "2177c9c",
        "environment": "production",
        "deployedAt": "2026-09-22T09:12:00Z",
        "commit": null,
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 3
      },
      {
        "id": "r-invoice-0",
        "projectId": "p-invoice",
        "version": "0.9.0",
        "environment": "production",
        "deployedAt": "2026-09-29T09:12:00Z",
        "commit": {
          "sha": "5f44d1a2e21409b052056eff1ca36f933c1fdeda",
          "message": "wip",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 3,
        "eventCount": 0
      },
      {
        "id": "r-portfolio-0",
        "projectId": "p-portfolio",
        "version": "37728ef",
        "environment": "production",
        "deployedAt": "2026-10-08T09:12:00Z",
        "commit": {
          "sha": "a16be86f3f9869713a17e7b589dd12aff1e056e5",
          "message": "Add gift wrap option at checkout (client request, see email 9 Oct)",
          "author": "Charles"
        },
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 0,
        "eventCount": 0
      },
      {
        "id": "r-portfolio-1",
        "projectId": "p-portfolio",
        "version": "1151e2a",
        "environment": "production",
        "deployedAt": "2026-09-23T09:12:00Z",
        "commit": null,
        "newIssues": 0,
        "regressedIssues": 0,
        "quietSinceDeploy": 1,
        "eventCount": 0
      }
    ],
    "monitorsDown": [
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
      }
    ]
  }
}
