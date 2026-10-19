// Generated fixture — invented data with realistic shape.
import type { AccessToken, AgentReport, Member } from "../src/contract/domain"

export const members: Member[] = [
  {
    "id": "m-owner",
    "name": "Charles",
    "email": "hello@sundial.dev",
    "role": "owner",
    "projectIds": "all",
    "joinedAt": "2025-09-08T09:12:00Z",
    "invitedAt": null,
    "inviteExpiresAt": null
  },
  {
    "id": "m-priya",
    "name": "Priya Natarajan",
    "email": "priya@natarajan.studio",
    "role": "collaborator",
    "projectIds": [
      "p-kiln",
      "p-harbour"
    ],
    "joinedAt": "2026-06-15T09:12:00Z",
    "invitedAt": null,
    "inviteExpiresAt": null
  },
  {
    "id": "m-tomasz",
    "name": "Tomasz Wiśniewski-Kowalczyk",
    "email": "tomasz.wisniewski-kowalczyk@outlook.com",
    "role": "collaborator",
    "projectIds": [
      "p-harbour"
    ],
    "joinedAt": "2026-09-13T09:12:00Z",
    "invitedAt": null,
    "inviteExpiresAt": null
  },
  {
    "id": "m-pending",
    "name": "dev@mossgrovehall.co.uk",
    "email": "dev@mossgrovehall.co.uk",
    "role": "collaborator",
    "projectIds": [
      "p-moss"
    ],
    "joinedAt": null,
    "invitedAt": "2026-10-11T09:12:00Z",
    "inviteExpiresAt": "2026-10-18T09:12:00Z"
  },
  {
    "id": "m-lapsed",
    "name": "practice.manager@harbourdental.co.uk",
    "email": "practice.manager@harbourdental.co.uk",
    "role": "collaborator",
    "projectIds": [
      "p-harbour"
    ],
    "joinedAt": null,
    "invitedAt": "2026-10-04T09:12:00Z",
    "inviteExpiresAt": "2026-10-11T09:12:00Z"
  }
]

/** The viewer's own tokens. Not seeded into the server: a seed can't hand out secrets. */
export const accessTokens: AccessToken[] = [
  { id: "at-laptop", name: "claude on laptop", createdAt: "2026-09-02T14:20:00Z", lastUsedAt: "2026-10-13T08:51:00Z" },
  { id: "at-codex", name: "codex on studio mac", createdAt: "2026-09-28T10:05:00Z", lastUsedAt: "2026-10-09T16:40:00Z" },
  { id: "at-ci", name: "nightly triage in ci", createdAt: "2026-10-12T19:30:00Z", lastUsedAt: null },
]

const owner = { id: "m-owner", name: "Charles", email: "hello@sundial.dev" }
const priya = { id: "m-priya", name: "Priya Natarajan", email: "priya@natarajan.studio" }

/** What agents told the owner about bertha itself, newest first. Not seeded, like tokens. */
export const agentReports: AgentReport[] = [
  {
    id: "ar-page",
    kind: "problem",
    summary: "get_issue doesn't say which page the error happened on",
    details:
      "Triaging KILN-Y. The event has no request, so I couldn't tell which product page hydrated wrong. The breadcrumbs end at `GET /api/cart 200`, which every page calls.\n\nWorked round it by matching the release against the deploy that changed `ProductGallery.tsx`. The page URL on browser events would have settled it.",
    tool: "get_issue",
    issue: { id: "i-hydration", shortId: "KILN-Y" },
    version: "0.5.6",
    by: owner,
    via: "claude on laptop",
    at: "2026-10-13T08:40:00Z",
    done: false,
  },
  {
    id: "ar-release-filter",
    kind: "request",
    summary: "list_events filtered by release",
    details: "HARB-1J has 400 events across six releases. To check whether 2.8.1 fixed it I needed only that release's events, and had to page through all of them.",
    tool: "list_events",
    issue: { id: "i-harbour-fetch", shortId: "HARB-1J" },
    version: "0.5.6",
    by: priya,
    via: "codex on studio mac",
    at: "2026-10-12T16:05:00Z",
    done: false,
  },
  {
    id: "ar-merge-timeout",
    kind: "problem",
    summary: "merge_issues answered \"Something went wrong on the server\" but the merge went through",
    details: "Merging MOSS-2I into MOSS-24. The first call failed, the retry said MOSS-2I doesn't exist. get_issue showed the merge had worked.",
    tool: "merge_issues",
    issue: null,
    version: "0.5.4",
    by: owner,
    via: "nightly triage in ci",
    at: "2026-10-09T02:14:00Z",
    done: true,
  },
  {
    id: "ar-sourcemaps",
    kind: "request",
    summary: "Say when a stack frame couldn't be source-mapped, and why",
    details: "",
    tool: null,
    issue: null,
    version: "0.5.3",
    by: priya,
    via: "codex on studio mac",
    at: "2026-10-06T11:30:00Z",
    done: false,
  },
]
