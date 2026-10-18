// Generated fixture — invented data with realistic shape.
import type { AlertDelivery, AlertDestination, AlertRule } from "../src/contract/domain"

export const destinations: AlertDestination[] = [
  {
    "id": "d-email",
    "kind": "email",
    "address": "hello@sundial.dev"
  },
  {
    "id": "d-push",
    "kind": "webhook",
    "label": "Phone push",
    "url": "https://push.example.net/hooks/k3J9xQ0w"
  },
  {
    "id": "d-chat",
    "kind": "webhook",
    "label": "Chat — #client-sites",
    "url": "https://chat.example.com/webhooks/T04B7/B07QW/xR2p8vLm1aZt"
  }
]

export const alertRules: AlertRule[] = [
  {
    "id": "a-new",
    "name": "Anything new or back",
    "projectIds": "all",
    "environments": [
      "production"
    ],
    "triggers": [
      "new_issue",
      "regression"
    ],
    "spike": null,
    "destinationIds": [
      "d-email"
    ],
    "enabled": true,
    "lastFiredAt": "2026-10-12T17:12:00Z"
  },
  {
    "id": "a-down",
    "name": "Client sites down",
    "projectIds": [
      "p-kiln",
      "p-harbour",
      "p-moss",
      "p-parish"
    ],
    "environments": [
      "production"
    ],
    "triggers": [
      "monitor_down",
      "monitor_degraded",
      "monitor_recovered"
    ],
    "spike": null,
    "destinationIds": [
      "d-push",
      "d-chat"
    ],
    "enabled": true,
    "lastFiredAt": "2026-10-13T08:47:00Z"
  },
  {
    "id": "a-spike",
    "name": "Shop spike",
    "projectIds": [
      "p-kiln"
    ],
    "environments": [
      "production"
    ],
    "triggers": [
      "spike"
    ],
    "spike": {
      "events": 200,
      "withinMinutes": 10
    },
    "destinationIds": [
      "d-push"
    ],
    "enabled": true,
    "lastFiredAt": "2026-10-12T18:12:00Z"
  },
  {
    "id": "a-personal",
    "name": "Personal projects",
    "projectIds": [
      "p-tides",
      "p-allot",
      "p-field",
      "p-portfolio",
      "p-invoice",
      "p-recipes"
    ],
    "environments": [
      "production"
    ],
    "triggers": [
      "new_issue",
      "monitor_down"
    ],
    "spike": null,
    "destinationIds": [
      "d-email"
    ],
    "enabled": false,
    "lastFiredAt": null
  }
]

/** Newest first: what bertha tried to send, and whether it went. */
export const deliveries: AlertDelivery[] = [
  {
    "id": "dl-9",
    "at": "2026-10-13T08:48:00Z",
    "ruleId": "a-down",
    "destinationId": "d-push",
    "ok": true,
    "error": null,
    "summary": "Harbour Dental bookings is down: HTTP 503 Service Unavailable"
  },
  {
    "id": "dl-8",
    "at": "2026-10-13T08:48:00Z",
    "ruleId": "a-down",
    "destinationId": "d-chat",
    "ok": false,
    "error": "The webhook returned 410 Gone. It may have been deleted on the other side.",
    "summary": "Harbour Dental bookings is down: HTTP 503 Service Unavailable"
  },
  {
    "id": "dl-7",
    "at": "2026-10-12T18:12:00Z",
    "ruleId": "a-spike",
    "destinationId": "d-push",
    "ok": true,
    "error": null,
    "summary": "Spike in Kiln & Clay: 214 events in 10m"
  },
  {
    "id": "dl-6",
    "at": "2026-10-12T17:12:00Z",
    "ruleId": "a-new",
    "destinationId": "d-email",
    "ok": true,
    "error": null,
    "summary": "New issue KILN-4F in Kiln & Clay"
  },
  {
    "id": "dl-5",
    "at": "2026-10-12T17:03:00Z",
    "ruleId": "a-new",
    "destinationId": "d-email",
    "ok": true,
    "error": null,
    "summary": "New issue KILN-4E in Kiln & Clay"
  },
  {
    "id": "dl-4",
    "at": "2026-10-11T22:40:00Z",
    "ruleId": "a-down",
    "destinationId": "d-push",
    "ok": true,
    "error": null,
    "summary": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal is degraded: responses over 4s"
  },
  {
    "id": "dl-3",
    "at": "2026-10-11T22:40:00Z",
    "ruleId": "a-down",
    "destinationId": "d-chat",
    "ok": true,
    "error": null,
    "summary": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal is degraded: responses over 4s"
  },
  {
    "id": "dl-2",
    "at": "2026-10-10T11:20:00Z",
    "ruleId": "a-new",
    "destinationId": "d-email",
    "ok": true,
    "error": null,
    "summary": "HARB-2C came back in Harbour Dental bookings"
  },
  {
    "id": "dl-0",
    "at": "2026-09-24T09:17:00Z",
    "ruleId": "a-down",
    "destinationId": "d-push",
    "ok": true,
    "error": null,
    "summary": "Harbour Dental bookings is back up after 4m"
  },
  {
    "id": "dl-1",
    "at": "2026-09-24T09:13:00Z",
    "ruleId": "a-down",
    "destinationId": "d-push",
    "ok": true,
    "error": null,
    "summary": "Harbour Dental bookings is down: Timed out after 10s"
  }
]
