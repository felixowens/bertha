// Generated fixture — invented data with realistic shape.
import type { AccessToken, Member } from "../src/contract/domain"

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
