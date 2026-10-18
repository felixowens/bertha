// Generated fixture — invented data with realistic shape.
import type { Member } from "../src/contract/domain"

export const members: Member[] = [
  {
    "id": "m-owner",
    "name": "Charles",
    "email": "hello@sundial.dev",
    "role": "owner",
    "projectIds": "all",
    "joinedAt": "2025-09-08T09:12:00Z"
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
    "joinedAt": "2026-06-15T09:12:00Z"
  },
  {
    "id": "m-tomasz",
    "name": "Tomasz Wiśniewski-Kowalczyk",
    "email": "tomasz.wisniewski-kowalczyk@outlook.com",
    "role": "collaborator",
    "projectIds": [
      "p-harbour"
    ],
    "joinedAt": "2026-09-13T09:12:00Z"
  },
  {
    "id": "m-pending",
    "name": "dev@mossgrovehall.co.uk",
    "email": "dev@mossgrovehall.co.uk",
    "role": "collaborator",
    "projectIds": [
      "p-moss"
    ],
    "joinedAt": null
  }
]
