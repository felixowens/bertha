// Generated fixture — invented data with realistic shape.
import type { AlertDestination, AlertRule } from "../contract/domain"

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
    "name": "Personal projects (weekdays only, really)",
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
