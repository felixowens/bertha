// Generated fixture — invented data with realistic shape.
import type { AppShell, AcceptInvitePage } from "../src/contract/pages"
type Ready<L> = L extends { status: "ready"; data: infer T } ? T : never

/** Signed in as the owner, or as a collaborator with access to two projects. */

export const shells: Record<"owner" | "collaborator", Ready<AppShell>> = {
  "owner": {
    "viewer": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev",
      "role": "owner",
      "projectIds": "all",
      "joinedAt": "2025-09-08T09:12:00Z"
    },
    "projects": [
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
      }
    ],
    "savedViews": [
      {
        "id": "v-mine",
        "name": "Assigned to me",
        "count": 7,
        "filter": {
          "assignee": "me",
          "status": "unresolved"
        }
      },
      {
        "id": "v-new",
        "name": "New this week",
        "count": 13,
        "filter": {
          "status": "unresolved",
          "sort": "first_seen",
          "range": "7d"
        }
      },
      {
        "id": "v-clients-fatal",
        "name": "Client sites, fatal",
        "count": 2,
        "filter": {
          "levels": [
            "fatal"
          ],
          "projectIds": [
            "p-kiln",
            "p-harbour",
            "p-moss",
            "p-parish"
          ]
        }
      }
    ],
    "counts": {
      "unresolved": 80,
      "assignedToMe": 7,
      "monitorsDown": 1
    }
  },
  "collaborator": {
    "viewer": {
      "id": "m-priya",
      "name": "Priya Natarajan",
      "email": "priya@natarajan.studio",
      "role": "collaborator",
      "projectIds": [
        "p-kiln",
        "p-harbour"
      ],
      "joinedAt": "2026-06-15T09:12:00Z"
    },
    "projects": [
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
      }
    ],
    "savedViews": [
      {
        "id": "v-mine",
        "name": "Assigned to me",
        "count": 2,
        "filter": {
          "assignee": "me",
          "status": "unresolved"
        }
      }
    ],
    "counts": {
      "unresolved": 44,
      "assignedToMe": 2,
      "monitorsDown": 1
    }
  }
}

/** Per invitation token (`valid`, `expired`, `used`). */
export const invites: Record<string, Ready<AcceptInvitePage>> = {
  "valid": {
    "status": "pending",
    "invitedBy": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "email": "dev@mossgrovehall.co.uk",
    "projectNames": [
      "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal"
    ]
  },
  "expired": {
    "status": "expired",
    "invitedBy": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "email": "dev@mossgrovehall.co.uk",
    "projectNames": [
      "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal"
    ]
  },
  "used": {
    "status": "used",
    "invitedBy": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "email": "dev@mossgrovehall.co.uk",
    "projectNames": [
      "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal"
    ]
  }
}
