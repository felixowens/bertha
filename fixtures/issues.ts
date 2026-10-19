// Generated fixture — invented data with realistic shape.
import type { Issue } from "../src/contract/domain"

export const issues: Issue[] = [
  {
    "id": "i-noisy",
    "shortId": "KILN-K",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "ResizeObserver loop completed with undelivered notifications.",
    "culprit": null,
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-07-31T09:12:00Z",
    "lastSeen": "2026-10-13T09:11:20Z",
    "eventCount": 48312,
    "eventsInRange": 20291,
    "userCount": 3904,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        451,
        856,
        379,
        510,
        405,
        809,
        322,
        891,
        561,
        516,
        843,
        897,
        730,
        701,
        821,
        1033,
        411,
        935,
        419,
        789,
        979,
        716,
        902,
        687,
        720,
        432,
        845,
        608,
        655,
        468
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 12,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/shop/mugs",
            "count": 31618
          },
          {
            "value": "https://kilnandclay.co.uk/checkout",
            "count": 7740
          },
          {
            "value": "https://kilnandclay.co.uk/products/speckled-oatmeal-mug-350ml?variant=4419&utm_source=instagram&utm_medium=social&utm_campaign=aw26_launch",
            "count": 4346
          },
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 4608
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 28847
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 11206
          },
          {
            "value": "Chrome Mobile 141",
            "count": 6008
          },
          {
            "value": "Firefox 143",
            "count": 2251
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Android 15",
            "count": 26384
          },
          {
            "value": "iOS 26.0.1",
            "count": 12460
          },
          {
            "value": "Linux",
            "count": 9468
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 24323
          },
          {
            "value": "2026.10.11-2",
            "count": 11727
          },
          {
            "value": "2026.10.9-3",
            "count": 12262
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 35480
          },
          {
            "value": "staging",
            "count": 12832
          }
        ]
      },
      {
        "key": "user",
        "distinct": 3904,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 6979
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5367
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1187
          },
          {
            "value": "u_00c4e1",
            "count": 961
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-07-31T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
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
    "eventsInRange": 212,
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
    "isRegression": false,
    "firstRelease": "2026.10.12-1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 17,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/shop/mugs",
            "count": 122
          },
          {
            "value": "https://kilnandclay.co.uk/checkout",
            "count": 42
          },
          {
            "value": "https://kilnandclay.co.uk/products/speckled-oatmeal-mug-350ml?variant=4419&utm_source=instagram&utm_medium=social&utm_campaign=aw26_launch",
            "count": 34
          },
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 14
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Firefox 143",
            "count": 141
          },
          {
            "value": "Chrome Mobile 141",
            "count": 36
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 26
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 9
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 107
          },
          {
            "value": "Android 15",
            "count": 75
          },
          {
            "value": "iOS 18.6.2",
            "count": 30
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 111
          },
          {
            "value": "2026.10.11-2",
            "count": 55
          },
          {
            "value": "2026.10.9-3",
            "count": 46
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 155
          },
          {
            "value": "staging",
            "count": 57
          }
        ]
      },
      {
        "key": "user",
        "distinct": 87,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 31
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 21
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 9
          },
          {
            "value": "u_00c4e1",
            "count": 3
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "note",
        "at": "2026-10-13T08:51:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "via": "claude on laptop",
        "body": "Cause: `CartDrawer` maps `cart.items` before the refetch settles. The cart endpoint returns `items: undefined` for an emptied basket, not `[]` (https://github.com/sundial-dev/kiln-and-clay/blob/a41c9e2/api/cart.ts#L88).\n\nFix: default to `[]` in the endpoint and guard the drawer, in https://github.com/sundial-dev/kiln-and-clay/pull/212 on Priya's gift-wrap branch (a41c9e2). Not related to KILN-K, which fires on the same page. Resolve in the next release once it merges."
      },
      {
        "kind": "note",
        "at": "2026-10-13T07:12:00Z",
        "by": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        },
        "body": "Happens when the basket is emptied from another tab while the drawer is open. `items` comes back `undefined` from the cart endpoint instead of `[]`.\n\nFix is in progress — see the gift-wrap branch."
      },
      {
        "kind": "merged",
        "at": "2026-10-12T21:40:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "via": "claude on laptop",
        "from": ["KILN-1T"]
      },
      {
        "kind": "assigned",
        "at": "2026-10-12T20:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-12T17:12:00Z",
        "release": "2026.10.12-1"
      }
    ]
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
    "eventsInRange": 1290,
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
    "isRegression": false,
    "firstRelease": "2026.10.12-1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 40,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/shop/mugs",
            "count": 965
          },
          {
            "value": "https://kilnandclay.co.uk/checkout",
            "count": 165
          },
          {
            "value": "https://kilnandclay.co.uk/products/speckled-oatmeal-mug-350ml?variant=4419&utm_source=instagram&utm_medium=social&utm_campaign=aw26_launch",
            "count": 90
          },
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 70
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 862
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 270
          },
          {
            "value": "Safari 26.0",
            "count": 73
          },
          {
            "value": "Chrome 141",
            "count": 85
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "Windows 11",
            "count": 899
          },
          {
            "value": "ChromeOS 141",
            "count": 221
          },
          {
            "value": "Linux",
            "count": 170
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 637
          },
          {
            "value": "2026.10.11-2",
            "count": 296
          },
          {
            "value": "2026.10.9-3",
            "count": 357
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 631
          },
          {
            "value": "staging",
            "count": 659
          }
        ]
      },
      {
        "key": "user",
        "distinct": 797,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 250
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 95
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 26
          },
          {
            "value": "u_00c4e1",
            "count": 16
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-12T18:12:00Z",
        "release": "2026.10.12-1"
      }
    ]
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
    "eventsInRange": 64,
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
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 31,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/shop/mugs",
            "count": 46
          },
          {
            "value": "https://kilnandclay.co.uk/checkout",
            "count": 11
          },
          {
            "value": "https://kilnandclay.co.uk/products/speckled-oatmeal-mug-350ml?variant=4419&utm_source=instagram&utm_medium=social&utm_campaign=aw26_launch",
            "count": 3
          },
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Chrome 141",
            "count": 35
          },
          {
            "value": "Edge 141",
            "count": 15
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 8
          },
          {
            "value": "Samsung Internet 28",
            "count": 6
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 30
          },
          {
            "value": "iOS 18.6.2",
            "count": 16
          },
          {
            "value": "Android 15",
            "count": 18
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 34
          },
          {
            "value": "2026.10.11-2",
            "count": 20
          },
          {
            "value": "2026.10.9-3",
            "count": 10
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 30
          },
          {
            "value": "staging",
            "count": 34
          }
        ]
      },
      {
        "key": "user",
        "distinct": 27,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 9
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 3
          },
          {
            "value": "u_00c4e1",
            "count": 2
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-12T17:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-5",
    "shortId": "KILN-1C",
    "projectId": "p-kiln",
    "type": "QuotaExceededError",
    "message": "Failed to execute 'setItem' on 'Storage': Setting the value of 'kc-basket-v2' exceeded the quota.",
    "culprit": "lib/basket/persist.ts in saveBasket",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "events",
      "total": 50,
      "remaining": 41
    },
    "assignee": null,
    "firstSeen": "2026-09-23T09:12:00Z",
    "lastSeen": "2026-10-12T13:19:00Z",
    "eventCount": 9,
    "eventsInRange": 7,
    "userCount": 3,
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
        1,
        0,
        0,
        0,
        1,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        0,
        1,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 9,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 9
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 6
          },
          {
            "value": "Edge 141",
            "count": 2
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 5
          },
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "ChromeOS 141",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 4
          },
          {
            "value": "2026.10.11-2",
            "count": 3
          },
          {
            "value": "2026.10.9-3",
            "count": 2
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 4
          },
          {
            "value": "staging",
            "count": 5
          }
        ]
      },
      {
        "key": "user",
        "distinct": 3,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-12T15:19:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "events",
          "total": 50,
          "remaining": 41
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-23T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
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
    "eventsInRange": 388,
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
    "isRegression": false,
    "firstRelease": "v2.14.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 24,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/book/whitby/slots",
            "count": 237
          },
          {
            "value": "https://book.harbourdental.co.uk/book/scarborough/slots",
            "count": 151
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 283
          },
          {
            "value": "Samsung Internet 28",
            "count": 57
          },
          {
            "value": "Edge 141",
            "count": 31
          },
          {
            "value": "Firefox 143",
            "count": 17
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 275
          },
          {
            "value": "ChromeOS 141",
            "count": 80
          },
          {
            "value": "macOS 15.6",
            "count": 33
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 244
          },
          {
            "value": "v2.13.0",
            "count": 105
          },
          {
            "value": "v2.12.0",
            "count": 39
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 256
          },
          {
            "value": "staging",
            "count": 132
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-13T08:41:00Z",
        "release": "v2.14.0"
      }
    ]
  },
  {
    "id": "i-7",
    "shortId": "HARB-1Q",
    "projectId": "p-harbour",
    "type": "UnhandledRejection",
    "message": "Error: Booking slot 2026-10-14T09:30:00+01:00 with Dr. O'Sullivan-Reyes is no longer available",
    "culprit": "lib/booking/hold.ts in holdSlot",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-tomasz",
      "name": "Tomasz Wiśniewski-Kowalczyk",
      "email": "tomasz.wisniewski-kowalczyk@outlook.com"
    },
    "firstSeen": "2026-10-04T09:12:00Z",
    "lastSeen": "2026-10-12T18:04:00Z",
    "eventCount": 17,
    "eventsInRange": 17,
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
        1,
        2,
        2,
        2,
        1,
        1,
        2,
        2,
        3,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 17,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 17
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 12
          },
          {
            "value": "Firefox 143",
            "count": 3
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          },
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "Android 15",
            "count": 10
          },
          {
            "value": "ChromeOS 141",
            "count": 3
          },
          {
            "value": "Windows 11",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 10
          },
          {
            "value": "v2.13.0",
            "count": 4
          },
          {
            "value": "v2.12.0",
            "count": 3
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 8
          },
          {
            "value": "staging",
            "count": 9
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 4
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-10-04T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-tomasz",
          "name": "Tomasz Wiśniewski-Kowalczyk",
          "email": "tomasz.wisniewski-kowalczyk@outlook.com"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-04T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-8",
    "shortId": "HARB-1X",
    "projectId": "p-harbour",
    "type": "TypeError",
    "message": "Cannot destructure property 'id' of 'session.user' as it is undefined.",
    "culprit": "app/account/appointments/page.tsx",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-09-21T09:12:00Z",
    "eventCount": 3,
    "eventsInRange": 3,
    "userCount": 2,
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
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 3,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 2
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 2
          },
          {
            "value": "v2.13.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          },
          {
            "value": "staging",
            "count": 2
          }
        ]
      },
      {
        "key": "user",
        "distinct": 2,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-09-21T10:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
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
    "eventsInRange": 46,
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
    "isRegression": true,
    "firstRelease": "v3.6.0",
    "regressedIn": "v3.8.1",
    "tags": [
      {
        "key": "url",
        "distinct": 35,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/enquire",
            "count": 25
          },
          {
            "value": "https://enquiries.mossgrovehall.co.uk/enquire?date=2027-06-19&type=ceremony-and-reception",
            "count": 21
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Firefox 143",
            "count": 27
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 11
          },
          {
            "value": "Chrome 141",
            "count": 4
          },
          {
            "value": "Chrome Mobile 141",
            "count": 4
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Android 15",
            "count": 32
          },
          {
            "value": "iOS 26.0.1",
            "count": 10
          },
          {
            "value": "Linux",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 32
          },
          {
            "value": "v3.8.0",
            "count": 8
          },
          {
            "value": "v3.7.2",
            "count": 6
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 46
          }
        ]
      },
      {
        "key": "user",
        "distinct": 17,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 7
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "regressed",
        "at": "2026-10-13T07:22:00Z",
        "release": "v3.8.1"
      },
      {
        "kind": "resolved",
        "at": "2026-09-22T21:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-02T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
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
    "eventsInRange": 11,
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
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 11
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 8
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 2
          },
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 6
          },
          {
            "value": "iOS 26.0.1",
            "count": 3
          },
          {
            "value": "Linux",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 8
          },
          {
            "value": "v3.8.0",
            "count": 2
          },
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 11
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-10T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-11",
    "shortId": "MOSS-2I",
    "projectId": "p-moss",
    "type": "Error",
    "message": "Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
    "culprit": "chunks/framework-6f3b2c.js",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-25T09:12:00Z",
    "lastSeen": "2026-10-09T23:27:00Z",
    "eventCount": 28,
    "eventsInRange": 29,
    "userCount": 6,
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
        1,
        2,
        2,
        1,
        2,
        2,
        1,
        1,
        1,
        2,
        2,
        2,
        1,
        1,
        1,
        1,
        2,
        2,
        2
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 28,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 28
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 16
          },
          {
            "value": "Edge 141",
            "count": 8
          },
          {
            "value": "Chrome 141",
            "count": 3
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 20
          },
          {
            "value": "Android 15",
            "count": 4
          },
          {
            "value": "iOS 18.6.2",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 20
          },
          {
            "value": "v3.8.0",
            "count": 4
          },
          {
            "value": "v3.7.2",
            "count": 4
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 28
          }
        ]
      },
      {
        "key": "user",
        "distinct": 6,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 5
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-10T01:27:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-25T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-no-stack",
    "shortId": "AIDN-2P",
    "projectId": "p-parish",
    "type": "ConsoleError",
    "message": "Newsletter archive: 3 issues have no PDF attached (Sept 2019, Advent 2021, Lent 2023)",
    "culprit": null,
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-07T09:12:00Z",
    "lastSeen": "2026-10-07T09:12:00Z",
    "eventCount": 2,
    "eventsInRange": 2,
    "userCount": 1,
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
        2,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": true,
    "isRegression": false,
    "firstRelease": "1.3.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://staidans-whitby.org.uk/",
            "count": 2
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Firefox 143",
            "count": 1
          },
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 1
          },
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "1.4.0",
            "count": 1
          },
          {
            "value": "1.3.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 2
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-07T09:12:00Z",
        "release": "1.3.0"
      }
    ]
  },
  {
    "id": "i-13",
    "shortId": "TIDE-2W",
    "projectId": "p-tides",
    "type": "Error",
    "message": "fetch failed: ECONNRESET (station feed 0065 Whitby)",
    "culprit": "src/sources/stationFeed.ts in fetchStation",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "until",
      "until": "2026-10-17T09:12:00Z"
    },
    "assignee": null,
    "firstSeen": "2026-10-01T09:12:00Z",
    "lastSeen": "2026-10-11T09:12:00Z",
    "eventCount": 31,
    "eventsInRange": 33,
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
        2,
        2,
        3,
        2,
        3,
        3,
        1,
        3,
        4,
        2,
        2,
        2,
        4
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 13,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 31
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 20
          },
          {
            "value": "ac64da3",
            "count": 6
          },
          {
            "value": "4c94515",
            "count": 5
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 31
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-11T11:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "until",
          "until": "2026-10-17T09:12:00Z"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-01T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-14",
    "shortId": "TIDE-33",
    "projectId": "p-tides",
    "type": "RangeError",
    "message": "Invalid harmonic constituent count: expected 37, got 0",
    "culprit": "src/predict/harmonics.ts in predictHeights",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-10T09:12:00Z",
    "lastSeen": "2026-09-10T09:12:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-09-10T10:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-10T09:12:00Z",
        "release": "f581a71"
      }
    ]
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
    "eventsInRange": 5,
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
    "isRegression": false,
    "firstRelease": "27a7795",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 5,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 5
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 3
          },
          {
            "value": "Edge 141",
            "count": 1
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 4
          },
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 2
          },
          {
            "value": "4ca9c53",
            "count": 2
          },
          {
            "value": "2fd10a5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 3
          },
          {
            "value": "development",
            "count": 2
          }
        ]
      },
      {
        "key": "user",
        "distinct": 2,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-12T13:12:00Z",
        "release": "27a7795"
      }
    ]
  },
  {
    "id": "i-16",
    "shortId": "INVC-3H",
    "projectId": "p-invoice",
    "type": "Error",
    "message": "Invoice run aborted: 3 of 41 invoices failed to render (PDF render timed out after 30000ms)",
    "culprit": "src/jobs/monthlyRun.ts in run",
    "level": "fatal",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-01T09:12:00Z",
    "lastSeen": "2026-10-01T09:12:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "0.8.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "worker",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "0.9.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "note",
        "at": "2026-10-01T10:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "body": "Re-ran by hand. Raised the render timeout to 60s."
      },
      {
        "kind": "resolved",
        "at": "2026-10-01T10:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-01T09:12:00Z",
        "release": "0.8.0"
      }
    ]
  },
  {
    "id": "i-17",
    "shortId": "FLDN-3O",
    "projectId": "p-field",
    "type": "Error",
    "message": "Image not found: /images/2024/08/hebrides-ferry.jpg",
    "culprit": "lib/posts/resolveImages.ts",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-03T09:12:00Z",
    "lastSeen": "2026-10-04T09:12:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "5f76e86",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://fieldnotes.sundial.dev/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome 141",
            "count": 3
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 3
          },
          {
            "value": "Windows 11",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 3,
        "values": [
          {
            "value": "8cddf58",
            "count": 2
          },
          {
            "value": "2177c9c",
            "count": 1
          },
          {
            "value": "5f76e86",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-03T09:12:00Z",
        "release": "5f76e86"
      }
    ]
  },
  {
    "id": "i-18",
    "shortId": "KILN-3V",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "Cannot read properties of null (reading 'getBoundingClientRect')",
    "culprit": "components/Carousel.tsx in measure",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-07-25T09:12:00Z",
    "lastSeen": "2026-10-08T03:46:00Z",
    "eventCount": 38,
    "eventsInRange": 39,
    "userCount": 13,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        1,
        1,
        2,
        2,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        1,
        2,
        2,
        1,
        2,
        1,
        2,
        1,
        1,
        1,
        1,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 25,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 38
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome 141",
            "count": 20
          },
          {
            "value": "Firefox 143",
            "count": 13
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 3
          },
          {
            "value": "Edge 141",
            "count": 2
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Windows 11",
            "count": 24
          },
          {
            "value": "iOS 26.0.1",
            "count": 9
          },
          {
            "value": "ChromeOS 141",
            "count": 5
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 21
          },
          {
            "value": "2026.10.11-2",
            "count": 9
          },
          {
            "value": "2026.10.9-3",
            "count": 8
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 24
          },
          {
            "value": "staging",
            "count": 14
          }
        ]
      },
      {
        "key": "user",
        "distinct": 13,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 6
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 3
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-07-25T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-19",
    "shortId": "KILN-42",
    "projectId": "p-kiln",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "events",
      "total": 100,
      "remaining": 58
    },
    "assignee": null,
    "firstSeen": "2026-08-04T09:12:00Z",
    "lastSeen": "2026-10-08T12:04:00Z",
    "eventCount": 256,
    "eventsInRange": 257,
    "userCount": 83,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        12,
        6,
        11,
        7,
        7,
        5,
        9,
        9,
        7,
        12,
        8,
        10,
        13,
        9,
        14,
        8,
        5,
        7,
        13,
        8,
        7,
        13,
        8,
        5,
        7,
        4,
        7,
        6,
        7,
        13
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 39,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 256
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 137
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 62
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 32
          },
          {
            "value": "Safari 26.0",
            "count": 25
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Windows 11",
            "count": 159
          },
          {
            "value": "ChromeOS 141",
            "count": 64
          },
          {
            "value": "iOS 18.6.2",
            "count": 33
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 122
          },
          {
            "value": "2026.10.11-2",
            "count": 91
          },
          {
            "value": "2026.10.9-3",
            "count": 43
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 190
          },
          {
            "value": "staging",
            "count": 66
          }
        ]
      },
      {
        "key": "user",
        "distinct": 83,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 52
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 15
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 6
          },
          {
            "value": "u_00c4e1",
            "count": 4
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-08T14:04:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "events",
          "total": 100,
          "remaining": 58
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-04T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-20",
    "shortId": "KILN-49",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-06T09:12:00Z",
    "lastSeen": "2026-10-11T16:53:00Z",
    "eventCount": 268,
    "eventsInRange": 268,
    "userCount": 86,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        9,
        8,
        11,
        11,
        5,
        11,
        7,
        11,
        7,
        12,
        12,
        12,
        10,
        4,
        6,
        10,
        10,
        4,
        5,
        7,
        12,
        10,
        10,
        10,
        10,
        8,
        11,
        10,
        9,
        6
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 7,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 268
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 187
          },
          {
            "value": "Samsung Internet 28",
            "count": 38
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 24
          },
          {
            "value": "Chrome Mobile 141",
            "count": 19
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 181
          },
          {
            "value": "macOS 15.6",
            "count": 51
          },
          {
            "value": "ChromeOS 141",
            "count": 36
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 175
          },
          {
            "value": "2026.10.11-2",
            "count": 69
          },
          {
            "value": "2026.10.9-3",
            "count": 24
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 186
          },
          {
            "value": "staging",
            "count": 82
          }
        ]
      },
      {
        "key": "user",
        "distinct": 86,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 59
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 15
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 3
          },
          {
            "value": "u_00c4e1",
            "count": 3
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-06T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-21",
    "shortId": "KILN-4G",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "Failed to construct 'URL': Invalid URL",
    "culprit": "lib/links.ts in absoluteUrl",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-03T09:12:00Z",
    "lastSeen": "2026-10-10T03:20:00Z",
    "eventCount": 338,
    "eventsInRange": 338,
    "userCount": 182,
    "environments": [
      "production",
      "staging"
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
        28,
        34,
        34,
        35,
        22,
        19,
        41,
        35,
        44,
        19,
        27
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 11,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 338
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 221
          },
          {
            "value": "Chrome 141",
            "count": 57
          },
          {
            "value": "Safari 26.0",
            "count": 38
          },
          {
            "value": "Firefox 143",
            "count": 22
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 233
          },
          {
            "value": "iOS 18.6.2",
            "count": 65
          },
          {
            "value": "Android 15",
            "count": 40
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 242
          },
          {
            "value": "2026.10.11-2",
            "count": 48
          },
          {
            "value": "2026.10.9-3",
            "count": 48
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 235
          },
          {
            "value": "staging",
            "count": 103
          }
        ]
      },
      {
        "key": "user",
        "distinct": 182,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 70
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 19
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 8
          },
          {
            "value": "u_00c4e1",
            "count": 4
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-03T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-22",
    "shortId": "KILN-4N",
    "projectId": "p-kiln",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-05T09:12:00Z",
    "lastSeen": "2026-10-09T20:32:00Z",
    "eventCount": 18,
    "eventsInRange": 18,
    "userCount": 11,
    "environments": [
      "production",
      "staging"
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
        1,
        1,
        1,
        2,
        1,
        4,
        2,
        3,
        3
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 18,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 18
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 12
          },
          {
            "value": "Samsung Internet 28",
            "count": 4
          },
          {
            "value": "Chrome 141",
            "count": 1
          },
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "Windows 11",
            "count": 10
          },
          {
            "value": "ChromeOS 141",
            "count": 4
          },
          {
            "value": "Android 15",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 12
          },
          {
            "value": "2026.10.11-2",
            "count": 4
          },
          {
            "value": "2026.10.9-3",
            "count": 2
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 12
          },
          {
            "value": "staging",
            "count": 6
          }
        ]
      },
      {
        "key": "user",
        "distinct": 11,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 4
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-09T22:32:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-05T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-23",
    "shortId": "KILN-4U",
    "projectId": "p-kiln",
    "type": "SyntaxError",
    "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    "culprit": "lib/api/client.ts in parseJson",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-02T09:12:00Z",
    "lastSeen": "2026-10-09T07:33:00Z",
    "eventCount": 3,
    "eventsInRange": 3,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 3,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Edge 141",
            "count": 2
          },
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 1
          },
          {
            "value": "Windows 11",
            "count": 1
          },
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 2
          },
          {
            "value": "2026.10.11-2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 2
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-02T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-24",
    "shortId": "KILN-51",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "connect ECONNREFUSED 10.0.3.12:5432",
    "culprit": "lib/db/pool.ts in connect",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-09-02T09:12:00Z",
    "lastSeen": "2026-10-07T17:14:00Z",
    "eventCount": 505,
    "eventsInRange": 504,
    "userCount": 205,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        21,
        26,
        11,
        19,
        19,
        11,
        18,
        23,
        11,
        11,
        10,
        16,
        17,
        8,
        25,
        8,
        21,
        14,
        23,
        12,
        12,
        19,
        22,
        19,
        21,
        14,
        13,
        26,
        21,
        13
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 34,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 505
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 245
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 193
          },
          {
            "value": "Chrome 141",
            "count": 48
          },
          {
            "value": "Chrome Mobile 141",
            "count": 19
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "Android 15",
            "count": 286
          },
          {
            "value": "iOS 18.6.2",
            "count": 120
          },
          {
            "value": "iOS 26.0.1",
            "count": 99
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 258
          },
          {
            "value": "2026.10.11-2",
            "count": 149
          },
          {
            "value": "2026.10.9-3",
            "count": 98
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 281
          },
          {
            "value": "staging",
            "count": 224
          }
        ]
      },
      {
        "key": "user",
        "distinct": 205,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 79
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 45
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 15
          },
          {
            "value": "u_00c4e1",
            "count": 13
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-07T19:14:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "assigned",
        "at": "2026-09-02T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-02T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-25",
    "shortId": "KILN-58",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-02T09:12:00Z",
    "lastSeen": "2026-10-08T02:38:00Z",
    "eventCount": 2,
    "eventsInRange": 2,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 2,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 2
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 1
          },
          {
            "value": "iOS 26.0.1",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 1
          },
          {
            "value": "2026.10.9-3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-02T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-26",
    "shortId": "KILN-5F",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-05T09:12:00Z",
    "lastSeen": "2026-10-09T07:37:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-05T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-27",
    "shortId": "KILN-5M",
    "projectId": "p-kiln",
    "type": "NotAllowedError",
    "message": "play() failed because the user didn't interact with the document first.",
    "culprit": "components/HeroVideo.tsx",
    "level": "warning",
    "status": "snoozed",
    "snooze": {
      "kind": "events",
      "total": 100,
      "remaining": 60
    },
    "assignee": null,
    "firstSeen": "2026-09-12T09:12:00Z",
    "lastSeen": "2026-10-12T16:41:00Z",
    "eventCount": 3,
    "eventsInRange": 3,
    "userCount": 1,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 3,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 2
          },
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "iOS 26.0.1",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 2
          },
          {
            "value": "2026.10.11-2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 2
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-12T18:41:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "events",
          "total": 100,
          "remaining": 60
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-12T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-28",
    "shortId": "KILN-5T",
    "projectId": "p-kiln",
    "type": "SyntaxError",
    "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    "culprit": "lib/api/client.ts in parseJson",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-02T09:12:00Z",
    "lastSeen": "2026-10-07T11:35:00Z",
    "eventCount": 108,
    "eventsInRange": 108,
    "userCount": 36,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        5,
        2,
        5,
        2,
        4,
        2,
        5,
        2,
        2,
        3,
        3,
        2,
        5,
        2,
        5,
        5,
        3,
        4,
        5,
        3,
        3,
        4,
        3,
        5,
        3,
        4,
        4,
        5,
        4
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 2,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 108
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 50
          },
          {
            "value": "Edge 141",
            "count": 37
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 12
          },
          {
            "value": "Samsung Internet 28",
            "count": 9
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 71
          },
          {
            "value": "Linux",
            "count": 17
          },
          {
            "value": "iOS 18.6.2",
            "count": 20
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 64
          },
          {
            "value": "2026.10.11-2",
            "count": 27
          },
          {
            "value": "2026.10.9-3",
            "count": 17
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 51
          },
          {
            "value": "staging",
            "count": 57
          }
        ]
      },
      {
        "key": "user",
        "distinct": 36,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 23
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 2
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-02T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-29",
    "shortId": "KILN-60",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "Cannot read properties of null (reading 'getBoundingClientRect')",
    "culprit": "components/Carousel.tsx in measure",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-04T09:12:00Z",
    "lastSeen": "2026-10-12T14:15:00Z",
    "eventCount": 826,
    "eventsInRange": 826,
    "userCount": 211,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        29,
        28,
        19,
        28,
        42,
        17,
        21,
        24,
        41,
        36,
        20,
        21,
        42,
        25,
        26,
        30,
        38,
        29,
        27,
        19,
        40,
        21,
        41,
        13,
        17,
        26,
        30,
        28,
        22,
        26
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 24,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 826
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 396
          },
          {
            "value": "Safari 26.0",
            "count": 282
          },
          {
            "value": "Edge 141",
            "count": 101
          },
          {
            "value": "Firefox 143",
            "count": 47
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Windows 11",
            "count": 374
          },
          {
            "value": "macOS 15.6",
            "count": 279
          },
          {
            "value": "iOS 18.6.2",
            "count": 173
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 452
          },
          {
            "value": "2026.10.11-2",
            "count": 186
          },
          {
            "value": "2026.10.9-3",
            "count": 188
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 431
          },
          {
            "value": "staging",
            "count": 395
          }
        ]
      },
      {
        "key": "user",
        "distinct": 211,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 130
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 66
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 37
          },
          {
            "value": "u_00c4e1",
            "count": 15
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-04T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-30",
    "shortId": "KILN-67",
    "projectId": "p-kiln",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-11T09:12:00Z",
    "lastSeen": "2026-10-11T09:12:00Z",
    "eventCount": 13,
    "eventsInRange": 13,
    "userCount": 6,
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
        6,
        3,
        4
      ]
    },
    "isNew": true,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 13,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 13
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 7
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 4
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          },
          {
            "value": "Samsung Internet 28",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Windows 11",
            "count": 9
          },
          {
            "value": "macOS 15.6",
            "count": 2
          },
          {
            "value": "iOS 26.0.1",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 9
          },
          {
            "value": "2026.10.11-2",
            "count": 3
          },
          {
            "value": "2026.10.9-3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 9
          },
          {
            "value": "staging",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 6,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-11T10:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-11T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-31",
    "shortId": "KILN-6E",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "NetworkError when attempting to fetch resource.",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-12T09:12:00Z",
    "lastSeen": "2026-10-08T23:42:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-12T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-32",
    "shortId": "KILN-6L",
    "projectId": "p-kiln",
    "type": "NotAllowedError",
    "message": "play() failed because the user didn't interact with the document first.",
    "culprit": "components/HeroVideo.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-25T09:12:00Z",
    "lastSeen": "2026-10-12T04:20:00Z",
    "eventCount": 402,
    "eventsInRange": 401,
    "userCount": 241,
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
        13,
        29,
        14,
        21,
        13,
        29,
        17,
        24,
        19,
        16,
        19,
        12,
        31,
        32,
        11,
        28,
        27,
        14,
        32
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 21,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 402
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 9,
        "values": [
          {
            "value": "Chrome 141",
            "count": 296
          },
          {
            "value": "Safari 26.0",
            "count": 62
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 33
          },
          {
            "value": "Chrome Mobile 141",
            "count": 11
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "Windows 11",
            "count": 210
          },
          {
            "value": "macOS 15.6",
            "count": 111
          },
          {
            "value": "ChromeOS 141",
            "count": 81
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 288
          },
          {
            "value": "2026.10.11-2",
            "count": 79
          },
          {
            "value": "2026.10.9-3",
            "count": 35
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 261
          },
          {
            "value": "staging",
            "count": 141
          }
        ]
      },
      {
        "key": "user",
        "distinct": 241,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 76
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 20
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 18
          },
          {
            "value": "u_00c4e1",
            "count": 7
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-25T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-33",
    "shortId": "KILN-6S",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "connect ECONNREFUSED 10.0.3.12:5432",
    "culprit": "lib/db/pool.ts in connect",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-26T09:12:00Z",
    "lastSeen": "2026-10-08T07:08:00Z",
    "eventCount": 612,
    "eventsInRange": 613,
    "userCount": 424,
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
        35,
        25,
        53,
        47,
        27,
        29,
        20,
        18,
        15,
        35,
        43,
        28,
        36,
        52,
        36,
        25,
        38,
        51
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 41,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 612
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 360
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 166
          },
          {
            "value": "Safari 26.0",
            "count": 55
          },
          {
            "value": "Edge 141",
            "count": 31
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 410
          },
          {
            "value": "Android 15",
            "count": 94
          },
          {
            "value": "ChromeOS 141",
            "count": 108
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 310
          },
          {
            "value": "2026.10.11-2",
            "count": 222
          },
          {
            "value": "2026.10.9-3",
            "count": 80
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 282
          },
          {
            "value": "staging",
            "count": 330
          }
        ]
      },
      {
        "key": "user",
        "distinct": 424,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 113
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 43
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 18
          },
          {
            "value": "u_00c4e1",
            "count": 10
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-26T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-34",
    "shortId": "KILN-6Z",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-06T09:12:00Z",
    "lastSeen": "2026-10-10T13:10:00Z",
    "eventCount": 424,
    "eventsInRange": 424,
    "userCount": 293,
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
        37,
        79,
        73,
        44,
        44,
        31,
        33,
        83
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 6,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 424
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Edge 141",
            "count": 305
          },
          {
            "value": "Samsung Internet 28",
            "count": 89
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 15
          },
          {
            "value": "Firefox 143",
            "count": 15
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 281
          },
          {
            "value": "Windows 11",
            "count": 76
          },
          {
            "value": "ChromeOS 141",
            "count": 67
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 212
          },
          {
            "value": "2026.10.11-2",
            "count": 109
          },
          {
            "value": "2026.10.9-3",
            "count": 103
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 239
          },
          {
            "value": "staging",
            "count": 185
          }
        ]
      },
      {
        "key": "user",
        "distinct": 293,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 84
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 27
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 9
          },
          {
            "value": "u_00c4e1",
            "count": 7
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-06T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-35",
    "shortId": "KILN-76",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "Cannot read properties of null (reading 'getBoundingClientRect')",
    "culprit": "components/Carousel.tsx in measure",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-20T09:12:00Z",
    "lastSeen": "2026-10-10T23:07:00Z",
    "eventCount": 815,
    "eventsInRange": 817,
    "userCount": 195,
    "environments": [
      "production",
      "staging"
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
        24,
        47,
        47,
        33,
        35,
        42,
        43,
        42,
        20,
        22,
        47,
        15,
        29,
        48,
        41,
        33,
        50,
        17,
        24,
        26,
        46,
        24,
        34,
        28
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 12,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 815
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Firefox 143",
            "count": 610
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 114
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 67
          },
          {
            "value": "Samsung Internet 28",
            "count": 24
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 606
          },
          {
            "value": "ChromeOS 141",
            "count": 117
          },
          {
            "value": "Android 15",
            "count": 92
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 412
          },
          {
            "value": "2026.10.11-2",
            "count": 236
          },
          {
            "value": "2026.10.9-3",
            "count": 167
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 583
          },
          {
            "value": "staging",
            "count": 232
          }
        ]
      },
      {
        "key": "user",
        "distinct": 195,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 122
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 92
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 23
          },
          {
            "value": "u_00c4e1",
            "count": 8
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-20T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-36",
    "shortId": "KILN-7D",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "timeout of 10000ms exceeded",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-08T09:12:00Z",
    "lastSeen": "2026-10-08T16:42:00Z",
    "eventCount": 828,
    "eventsInRange": 824,
    "userCount": 188,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        25,
        35,
        18,
        24,
        27,
        40,
        17,
        37,
        39,
        33,
        30,
        26,
        37,
        19,
        16,
        15,
        39,
        27,
        16,
        24,
        34,
        17,
        15,
        18,
        27,
        39,
        26,
        35,
        37,
        32
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 8,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 828
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Firefox 143",
            "count": 426
          },
          {
            "value": "Chrome Mobile 141",
            "count": 238
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 76
          },
          {
            "value": "Safari 26.0",
            "count": 88
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Windows 11",
            "count": 490
          },
          {
            "value": "macOS 15.6",
            "count": 227
          },
          {
            "value": "ChromeOS 141",
            "count": 111
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 494
          },
          {
            "value": "2026.10.11-2",
            "count": 204
          },
          {
            "value": "2026.10.9-3",
            "count": 130
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 388
          },
          {
            "value": "staging",
            "count": 440
          }
        ]
      },
      {
        "key": "user",
        "distinct": 188,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 178
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 48
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 14
          },
          {
            "value": "u_00c4e1",
            "count": 8
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-08T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-37",
    "shortId": "KILN-7K",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Request failed with status code 429",
    "culprit": "lib/shipping/quote.ts in getQuote",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-09-17T09:12:00Z",
    "lastSeen": "2026-10-12T08:50:00Z",
    "eventCount": 217,
    "eventsInRange": 217,
    "userCount": 87,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        0,
        0,
        0,
        4,
        10,
        13,
        5,
        11,
        7,
        7,
        8,
        4,
        12,
        5,
        7,
        12,
        12,
        5,
        7,
        6,
        8,
        9,
        9,
        9,
        12,
        4,
        10,
        5,
        4,
        12
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 41,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 217
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Firefox 143",
            "count": 159
          },
          {
            "value": "Chrome Mobile 141",
            "count": 32
          },
          {
            "value": "Edge 141",
            "count": 14
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 12
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Windows 11",
            "count": 123
          },
          {
            "value": "ChromeOS 141",
            "count": 51
          },
          {
            "value": "macOS 15.6",
            "count": 43
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 140
          },
          {
            "value": "2026.10.11-2",
            "count": 37
          },
          {
            "value": "2026.10.9-3",
            "count": 40
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 112
          },
          {
            "value": "staging",
            "count": 105
          }
        ]
      },
      {
        "key": "user",
        "distinct": 87,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 32
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 17
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 8
          },
          {
            "value": "u_00c4e1",
            "count": 8
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-12T09:50:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "assigned",
        "at": "2026-09-17T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-17T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-38",
    "shortId": "KILN-7R",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-22T09:12:00Z",
    "lastSeen": "2026-10-11T07:01:00Z",
    "eventCount": 516,
    "eventsInRange": 518,
    "userCount": 344,
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
        29,
        23,
        37,
        28,
        22,
        17,
        34,
        34,
        15,
        21,
        38,
        13,
        16,
        18,
        13,
        21,
        12,
        28,
        29,
        23,
        14,
        33
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 31,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 516
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 330
          },
          {
            "value": "Chrome Mobile 141",
            "count": 129
          },
          {
            "value": "Firefox 143",
            "count": 27
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 30
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 281
          },
          {
            "value": "Windows 11",
            "count": 163
          },
          {
            "value": "macOS 15.6",
            "count": 72
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 282
          },
          {
            "value": "2026.10.11-2",
            "count": 166
          },
          {
            "value": "2026.10.9-3",
            "count": 68
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 245
          },
          {
            "value": "staging",
            "count": 271
          }
        ]
      },
      {
        "key": "user",
        "distinct": 344,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 92
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 46
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 11
          },
          {
            "value": "u_00c4e1",
            "count": 6
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-22T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-39",
    "shortId": "KILN-7Y",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Failed to load script: https://maps.googleapis.com/maps/js?callback=initMap&libraries=places",
    "culprit": "components/VenueMap.tsx",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-05T09:12:00Z",
    "lastSeen": "2026-10-12T06:43:00Z",
    "eventCount": 26,
    "eventsInRange": 27,
    "userCount": 11,
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
        2,
        2,
        4,
        2,
        4,
        3,
        3,
        4,
        3
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 26,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 26
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Chrome 141",
            "count": 19
          },
          {
            "value": "Chrome Mobile 141",
            "count": 5
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          },
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Windows 11",
            "count": 12
          },
          {
            "value": "Android 15",
            "count": 7
          },
          {
            "value": "Linux",
            "count": 7
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 19
          },
          {
            "value": "2026.10.11-2",
            "count": 5
          },
          {
            "value": "2026.10.9-3",
            "count": 2
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 15
          },
          {
            "value": "staging",
            "count": 11
          }
        ]
      },
      {
        "key": "user",
        "distinct": 11,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 6
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-12T08:43:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-05T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-40",
    "shortId": "KILN-85",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "No response",
    "culprit": "webkit-masked-url://hidden/ in r",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-11T09:12:00Z",
    "lastSeen": "2026-10-11T09:12:00Z",
    "eventCount": 19,
    "eventsInRange": 19,
    "userCount": 10,
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
        7,
        3,
        9
      ]
    },
    "isNew": true,
    "isRegression": false,
    "firstRelease": "2026.10.9-3",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 2,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/courses/discounted-packages",
            "count": 16
          },
          {
            "value": "https://kilnandclay.co.uk/courses",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 1,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 19
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iPadOS 26.0",
            "count": 12
          },
          {
            "value": "macOS 15.6",
            "count": 7
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "2026.10.9-3",
            "count": 11
          },
          {
            "value": "2026.10.11-2",
            "count": 8
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 19
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-11T09:12:00Z",
        "release": "2026.10.9-3"
      }
    ]
  },
  {
    "id": "i-41",
    "shortId": "KILN-8C",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-29T09:12:00Z",
    "lastSeen": "2026-10-08T01:03:00Z",
    "eventCount": 7,
    "eventsInRange": 7,
    "userCount": 2,
    "environments": [
      "production",
      "staging"
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
        1,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 7,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 7
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 3
          },
          {
            "value": "Chrome 141",
            "count": 2
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          },
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 3
          },
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "Linux",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 5
          },
          {
            "value": "2026.10.11-2",
            "count": 1
          },
          {
            "value": "2026.10.9-3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 4
          },
          {
            "value": "staging",
            "count": 3
          }
        ]
      },
      {
        "key": "user",
        "distinct": 2,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-29T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-42",
    "shortId": "KILN-8J",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "timeout of 10000ms exceeded",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-10T09:12:00Z",
    "lastSeen": "2026-10-08T18:35:00Z",
    "eventCount": 355,
    "eventsInRange": 357,
    "userCount": 212,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        12,
        15,
        17,
        17,
        6,
        15,
        7,
        7,
        14,
        9,
        14,
        9,
        13,
        6,
        16,
        14,
        16,
        8,
        12,
        13,
        15,
        11,
        12,
        8,
        11,
        10,
        6,
        16,
        17,
        11
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 21,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 355
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 227
          },
          {
            "value": "Chrome Mobile 141",
            "count": 86
          },
          {
            "value": "Chrome 141",
            "count": 24
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 18
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 257
          },
          {
            "value": "Linux",
            "count": 65
          },
          {
            "value": "iOS 18.6.2",
            "count": 33
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 203
          },
          {
            "value": "2026.10.11-2",
            "count": 98
          },
          {
            "value": "2026.10.9-3",
            "count": 54
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 200
          },
          {
            "value": "staging",
            "count": 155
          }
        ]
      },
      {
        "key": "user",
        "distinct": 212,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 53
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 31
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 15
          },
          {
            "value": "u_00c4e1",
            "count": 8
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-10T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-43",
    "shortId": "KILN-8Q",
    "projectId": "p-kiln",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-01T09:12:00Z",
    "lastSeen": "2026-10-10T02:03:00Z",
    "eventCount": 56,
    "eventsInRange": 54,
    "userCount": 36,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        2,
        1,
        3,
        1,
        3,
        1,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        3,
        3,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        1,
        2,
        2,
        1,
        1,
        3,
        2
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 11,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 56
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Chrome 141",
            "count": 33
          },
          {
            "value": "Chrome Mobile 141",
            "count": 13
          },
          {
            "value": "Firefox 143",
            "count": 5
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 5
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Windows 11",
            "count": 35
          },
          {
            "value": "iOS 18.6.2",
            "count": 11
          },
          {
            "value": "Android 15",
            "count": 10
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 26
          },
          {
            "value": "2026.10.11-2",
            "count": 14
          },
          {
            "value": "2026.10.9-3",
            "count": 16
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 27
          },
          {
            "value": "staging",
            "count": 29
          }
        ]
      },
      {
        "key": "user",
        "distinct": 36,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 8
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 6
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-01T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-44",
    "shortId": "KILN-8X",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-15T09:12:00Z",
    "lastSeen": "2026-10-11T19:50:00Z",
    "eventCount": 95,
    "eventsInRange": 96,
    "userCount": 52,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        5,
        3,
        5,
        5,
        4,
        4,
        3,
        3,
        2,
        2,
        4,
        2,
        2,
        4,
        3,
        4,
        2,
        3,
        4,
        2,
        2,
        2,
        4,
        3,
        3,
        2,
        3,
        4,
        2,
        5
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 12,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 95
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 68
          },
          {
            "value": "Chrome 141",
            "count": 14
          },
          {
            "value": "Firefox 143",
            "count": 9
          },
          {
            "value": "Edge 141",
            "count": 4
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 71
          },
          {
            "value": "iOS 18.6.2",
            "count": 17
          },
          {
            "value": "ChromeOS 141",
            "count": 7
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 57
          },
          {
            "value": "2026.10.11-2",
            "count": 26
          },
          {
            "value": "2026.10.9-3",
            "count": 12
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 66
          },
          {
            "value": "staging",
            "count": 29
          }
        ]
      },
      {
        "key": "user",
        "distinct": 52,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 20
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 2
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-15T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-45",
    "shortId": "KILN-94",
    "projectId": "p-kiln",
    "type": "SecurityError",
    "message": "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
    "culprit": "lib/basket/persist.ts in loadBasket",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-02T09:12:00Z",
    "lastSeen": "2026-10-10T14:10:00Z",
    "eventCount": 14,
    "eventsInRange": 14,
    "userCount": 7,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 14,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 14
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 8,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 7
          },
          {
            "value": "Chrome Mobile 141",
            "count": 5
          },
          {
            "value": "Edge 141",
            "count": 1
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 7
          },
          {
            "value": "Linux",
            "count": 4
          },
          {
            "value": "macOS 15.6",
            "count": 3
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 10
          },
          {
            "value": "2026.10.11-2",
            "count": 3
          },
          {
            "value": "2026.10.9-3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 8
          },
          {
            "value": "staging",
            "count": 6
          }
        ]
      },
      {
        "key": "user",
        "distinct": 7,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 3
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-02T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-46",
    "shortId": "KILN-9B",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-22T09:12:00Z",
    "lastSeen": "2026-10-07T14:40:00Z",
    "eventCount": 234,
    "eventsInRange": 233,
    "userCount": 70,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        9,
        7,
        10,
        7,
        11,
        7,
        11,
        10,
        10,
        11,
        10,
        10,
        5,
        4,
        9,
        11,
        4,
        7,
        5,
        9,
        4,
        9,
        10,
        4,
        7,
        8,
        8,
        4,
        6,
        6
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 27,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 234
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Chrome 141",
            "count": 155
          },
          {
            "value": "Edge 141",
            "count": 55
          },
          {
            "value": "Chrome Mobile 141",
            "count": 12
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 12
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 106
          },
          {
            "value": "ChromeOS 141",
            "count": 82
          },
          {
            "value": "macOS 15.6",
            "count": 46
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 130
          },
          {
            "value": "2026.10.11-2",
            "count": 67
          },
          {
            "value": "2026.10.9-3",
            "count": 37
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 122
          },
          {
            "value": "staging",
            "count": 112
          }
        ]
      },
      {
        "key": "user",
        "distinct": 70,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 40
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 16
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 9
          },
          {
            "value": "u_00c4e1",
            "count": 5
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-07T15:40:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-22T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-47",
    "shortId": "KILN-9I",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "Failed to load script: https://maps.googleapis.com/maps/js?callback=initMap&libraries=places",
    "culprit": "components/VenueMap.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-09T09:12:00Z",
    "lastSeen": "2026-10-12T15:41:00Z",
    "eventCount": 52,
    "eventsInRange": 53,
    "userCount": 33,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        2,
        1,
        2,
        2,
        2,
        1,
        2,
        2,
        2,
        2,
        1,
        3,
        1,
        2,
        2,
        1,
        1,
        2,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        1,
        2,
        2,
        2
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 40,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 52
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 36
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 8
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 5
          },
          {
            "value": "Safari 26.0",
            "count": 3
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 36
          },
          {
            "value": "iOS 18.6.2",
            "count": 11
          },
          {
            "value": "Windows 11",
            "count": 5
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 29
          },
          {
            "value": "2026.10.11-2",
            "count": 17
          },
          {
            "value": "2026.10.9-3",
            "count": 6
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 32
          },
          {
            "value": "staging",
            "count": 20
          }
        ]
      },
      {
        "key": "user",
        "distinct": 33,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 11
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 3
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-09T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-48",
    "shortId": "KILN-9P",
    "projectId": "p-kiln",
    "type": "Error",
    "message": "ENOENT: no such file or directory, open '/var/task/content/posts/draft-autumn-planting.md'",
    "culprit": "lib/content/load.ts in loadPost",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-16T09:12:00Z",
    "lastSeen": "2026-10-09T19:02:00Z",
    "eventCount": 468,
    "eventsInRange": 468,
    "userCount": 285,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        18,
        19,
        9,
        14,
        22,
        16,
        16,
        9,
        21,
        13,
        10,
        17,
        21,
        11,
        19,
        10,
        19,
        21,
        19,
        7,
        21,
        9,
        10,
        14,
        20,
        22,
        21,
        8,
        19,
        13
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 9,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 468
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 336
          },
          {
            "value": "Edge 141",
            "count": 96
          },
          {
            "value": "Firefox 143",
            "count": 19
          },
          {
            "value": "Chrome Mobile 141",
            "count": 17
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Linux",
            "count": 324
          },
          {
            "value": "Windows 11",
            "count": 67
          },
          {
            "value": "iOS 26.0.1",
            "count": 77
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 260
          },
          {
            "value": "2026.10.11-2",
            "count": 97
          },
          {
            "value": "2026.10.9-3",
            "count": 111
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 298
          },
          {
            "value": "staging",
            "count": 170
          }
        ]
      },
      {
        "key": "user",
        "distinct": 285,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 92
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 26
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 16
          },
          {
            "value": "u_00c4e1",
            "count": 6
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-16T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-49",
    "shortId": "KILN-9W",
    "projectId": "p-kiln",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-21T09:12:00Z",
    "lastSeen": "2026-10-08T16:14:00Z",
    "eventCount": 3,
    "eventsInRange": 3,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 3,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 9,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 2
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Windows 11",
            "count": 2
          },
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 1
          },
          {
            "value": "2026.10.11-2",
            "count": 1
          },
          {
            "value": "2026.10.9-3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 2
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-21T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-50",
    "shortId": "KILN-A3",
    "projectId": "p-kiln",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-11T09:12:00Z",
    "lastSeen": "2026-10-10T23:42:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-11T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-51",
    "shortId": "KILN-AA",
    "projectId": "p-kiln",
    "type": "NotAllowedError",
    "message": "play() failed because the user didn't interact with the document first.",
    "culprit": "components/HeroVideo.tsx",
    "level": "warning",
    "status": "snoozed",
    "snooze": {
      "kind": "until",
      "until": "2026-10-24T09:12:00Z"
    },
    "assignee": null,
    "firstSeen": "2026-09-25T09:12:00Z",
    "lastSeen": "2026-10-11T00:19:00Z",
    "eventCount": 49,
    "eventsInRange": 48,
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
        3,
        2,
        3,
        1,
        3,
        3,
        2,
        2,
        3,
        2,
        3,
        2,
        3,
        3,
        2,
        3,
        3,
        2,
        3
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "2026.10.13-rc1",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 36,
        "values": [
          {
            "value": "https://kilnandclay.co.uk/",
            "count": 49
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 24
          },
          {
            "value": "Chrome 141",
            "count": 15
          },
          {
            "value": "Safari 26.0",
            "count": 5
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 5
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 29
          },
          {
            "value": "Android 15",
            "count": 13
          },
          {
            "value": "Linux",
            "count": 7
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "2026.10.12-1",
            "count": 32
          },
          {
            "value": "2026.10.11-2",
            "count": 10
          },
          {
            "value": "2026.10.9-3",
            "count": 7
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 24
          },
          {
            "value": "staging",
            "count": 25
          }
        ]
      },
      {
        "key": "user",
        "distinct": 16,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 8
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 5
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-11T02:19:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "until",
          "until": "2026-10-24T09:12:00Z"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-25T09:12:00Z",
        "release": "2026.10.13-rc1"
      }
    ]
  },
  {
    "id": "i-52",
    "shortId": "HARB-AH",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "connect ECONNREFUSED 10.0.3.12:5432",
    "culprit": "lib/db/pool.ts in connect",
    "level": "fatal",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-19T09:12:00Z",
    "lastSeen": "2026-10-11T18:08:00Z",
    "eventCount": 223,
    "eventsInRange": 223,
    "userCount": 143,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
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
        10,
        6,
        7,
        5,
        10,
        4,
        9,
        10,
        9,
        5,
        9,
        9,
        4
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 38,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 223
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 153
          },
          {
            "value": "Chrome 141",
            "count": 38
          },
          {
            "value": "Edge 141",
            "count": 20
          },
          {
            "value": "Safari 26.0",
            "count": 12
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 155
          },
          {
            "value": "macOS 15.6",
            "count": 44
          },
          {
            "value": "Android 15",
            "count": 24
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 138
          },
          {
            "value": "v2.13.0",
            "count": 41
          },
          {
            "value": "v2.12.0",
            "count": 44
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 115
          },
          {
            "value": "staging",
            "count": 108
          }
        ]
      },
      {
        "key": "user",
        "distinct": 143,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 36
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 21
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 5
          },
          {
            "value": "u_00c4e1",
            "count": 5
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-19T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-53",
    "shortId": "HARB-AO",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-31T09:12:00Z",
    "lastSeen": "2026-10-10T18:31:00Z",
    "eventCount": 197,
    "eventsInRange": 194,
    "userCount": 47,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        8,
        7,
        6,
        8,
        5,
        5,
        5,
        9,
        10,
        9,
        3,
        4,
        9,
        4,
        6,
        4,
        10,
        5,
        4,
        4,
        7,
        8,
        8,
        8,
        6,
        7,
        8,
        3,
        7,
        7
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 40,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 197
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 93
          },
          {
            "value": "Edge 141",
            "count": 52
          },
          {
            "value": "Firefox 143",
            "count": 39
          },
          {
            "value": "Chrome Mobile 141",
            "count": 13
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "Windows 11",
            "count": 103
          },
          {
            "value": "macOS 15.6",
            "count": 48
          },
          {
            "value": "iOS 26.0.1",
            "count": 46
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 101
          },
          {
            "value": "v2.13.0",
            "count": 43
          },
          {
            "value": "v2.12.0",
            "count": 53
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 127
          },
          {
            "value": "staging",
            "count": 70
          }
        ]
      },
      {
        "key": "user",
        "distinct": 47,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 44
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 10
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 3
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-31T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-54",
    "shortId": "HARB-AV",
    "projectId": "p-harbour",
    "type": "TypeError",
    "message": "Cannot read properties of null (reading 'getBoundingClientRect')",
    "culprit": "components/Carousel.tsx in measure",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-priya",
      "name": "Priya Natarajan",
      "email": "priya@natarajan.studio"
    },
    "firstSeen": "2026-07-31T09:12:00Z",
    "lastSeen": "2026-10-10T13:09:00Z",
    "eventCount": 140,
    "eventsInRange": 138,
    "userCount": 86,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        4,
        5,
        6,
        3,
        6,
        6,
        6,
        7,
        5,
        5,
        4,
        2,
        7,
        6,
        6,
        2,
        3,
        3,
        2,
        6,
        5,
        6,
        7,
        7,
        2,
        3,
        2,
        4,
        5
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 21,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 140
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 8,
        "values": [
          {
            "value": "Edge 141",
            "count": 101
          },
          {
            "value": "Safari 26.0",
            "count": 22
          },
          {
            "value": "Chrome Mobile 141",
            "count": 9
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 8
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 96
          },
          {
            "value": "Linux",
            "count": 25
          },
          {
            "value": "ChromeOS 141",
            "count": 19
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 69
          },
          {
            "value": "v2.13.0",
            "count": 42
          },
          {
            "value": "v2.12.0",
            "count": 29
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 88
          },
          {
            "value": "staging",
            "count": 52
          }
        ]
      },
      {
        "key": "user",
        "distinct": 86,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 30
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 9
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-07-31T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-priya",
          "name": "Priya Natarajan",
          "email": "priya@natarajan.studio"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-07-31T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-55",
    "shortId": "HARB-B2",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-21T09:12:00Z",
    "lastSeen": "2026-10-10T20:02:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 9,
        "values": [
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-10T22:02:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-21T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-56",
    "shortId": "HARB-B9",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "ENOENT: no such file or directory, open '/var/task/content/posts/draft-autumn-planting.md'",
    "culprit": "lib/content/load.ts in loadPost",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-08T09:12:00Z",
    "lastSeen": "2026-10-08T09:12:00Z",
    "eventCount": 2,
    "eventsInRange": 2,
    "userCount": 1,
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
        2,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": true,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 2,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 2
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 1
          },
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 1
          },
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 1
          },
          {
            "value": "v2.13.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-08T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-57",
    "shortId": "HARB-BG",
    "projectId": "p-harbour",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-10-07T14:53:00Z",
    "eventCount": 881,
    "eventsInRange": 882,
    "userCount": 281,
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
        20,
        25,
        31,
        35,
        31,
        32,
        37,
        43,
        45,
        20,
        19,
        44,
        45,
        29,
        55,
        52,
        39,
        19,
        36,
        22,
        28,
        37,
        26,
        27,
        36,
        49
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 12,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 881
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 530
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 185
          },
          {
            "value": "Chrome 141",
            "count": 105
          },
          {
            "value": "Safari 26.0",
            "count": 61
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "Linux",
            "count": 496
          },
          {
            "value": "iOS 18.6.2",
            "count": 253
          },
          {
            "value": "Android 15",
            "count": 132
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 427
          },
          {
            "value": "v2.13.0",
            "count": 240
          },
          {
            "value": "v2.12.0",
            "count": 214
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 607
          },
          {
            "value": "staging",
            "count": 274
          }
        ]
      },
      {
        "key": "user",
        "distinct": 281,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 131
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 91
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 26
          },
          {
            "value": "u_00c4e1",
            "count": 16
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-58",
    "shortId": "HARB-BN",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "timeout of 10000ms exceeded",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-10-09T17:04:00Z",
    "eventCount": 84,
    "eventsInRange": 86,
    "userCount": 36,
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
        2,
        4,
        4,
        5,
        4,
        4,
        4,
        4,
        2,
        2,
        4,
        4,
        4,
        5,
        5,
        4,
        4,
        2,
        2,
        2,
        2,
        2,
        1,
        3,
        4,
        3
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 21,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 84
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Chrome 141",
            "count": 40
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 29
          },
          {
            "value": "Samsung Internet 28",
            "count": 11
          },
          {
            "value": "Firefox 143",
            "count": 4
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 42
          },
          {
            "value": "Android 15",
            "count": 27
          },
          {
            "value": "Linux",
            "count": 15
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 59
          },
          {
            "value": "v2.13.0",
            "count": 15
          },
          {
            "value": "v2.12.0",
            "count": 10
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 44
          },
          {
            "value": "staging",
            "count": 40
          }
        ]
      },
      {
        "key": "user",
        "distinct": 36,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 12
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 9
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 3
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-59",
    "shortId": "HARB-BU",
    "projectId": "p-harbour",
    "type": "TypeError",
    "message": "e.toFixed is not a function",
    "culprit": "chunks/4410-91be2d.js in a",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": {
      "id": "m-tomasz",
      "name": "Tomasz Wiśniewski-Kowalczyk",
      "email": "tomasz.wisniewski-kowalczyk@outlook.com"
    },
    "firstSeen": "2026-10-03T09:12:00Z",
    "lastSeen": "2026-10-13T04:36:00Z",
    "eventCount": 468,
    "eventsInRange": 468,
    "userCount": 109,
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
        50,
        26,
        65,
        48,
        70,
        38,
        42,
        33,
        30,
        39,
        27
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 30,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 468
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome 141",
            "count": 288
          },
          {
            "value": "Firefox 143",
            "count": 107
          },
          {
            "value": "Edge 141",
            "count": 49
          },
          {
            "value": "Safari 26.0",
            "count": 24
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 340
          },
          {
            "value": "Android 15",
            "count": 65
          },
          {
            "value": "ChromeOS 141",
            "count": 63
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 253
          },
          {
            "value": "v2.13.0",
            "count": 122
          },
          {
            "value": "v2.12.0",
            "count": 93
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 323
          },
          {
            "value": "staging",
            "count": 145
          }
        ]
      },
      {
        "key": "user",
        "distinct": 109,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 94
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 28
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 13
          },
          {
            "value": "u_00c4e1",
            "count": 5
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-13T06:36:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "assigned",
        "at": "2026-10-03T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-tomasz",
          "name": "Tomasz Wiśniewski-Kowalczyk",
          "email": "tomasz.wisniewski-kowalczyk@outlook.com"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-03T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-60",
    "shortId": "HARB-C1",
    "projectId": "p-harbour",
    "type": "TypeError",
    "message": "Load failed",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-10-13T05:53:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production",
      "staging"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Windows 11",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-61",
    "shortId": "HARB-C8",
    "projectId": "p-harbour",
    "type": "AbortError",
    "message": "The operation was aborted.",
    "culprit": "hooks/useSearch.ts in useSearch",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-10-12T09:12:00Z",
    "lastSeen": "2026-10-12T09:12:00Z",
    "eventCount": 14,
    "eventsInRange": 14,
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
        0,
        0,
        6,
        8
      ]
    },
    "isNew": true,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 14,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 14
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 8
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 3
          },
          {
            "value": "Firefox 143",
            "count": 2
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Linux",
            "count": 7
          },
          {
            "value": "macOS 15.6",
            "count": 3
          },
          {
            "value": "Windows 11",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 8
          },
          {
            "value": "v2.13.0",
            "count": 3
          },
          {
            "value": "v2.12.0",
            "count": 3
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 10
          },
          {
            "value": "staging",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-10-12T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-12T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-62",
    "shortId": "HARB-CF",
    "projectId": "p-harbour",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-tomasz",
      "name": "Tomasz Wiśniewski-Kowalczyk",
      "email": "tomasz.wisniewski-kowalczyk@outlook.com"
    },
    "firstSeen": "2026-10-03T09:12:00Z",
    "lastSeen": "2026-10-12T00:35:00Z",
    "eventCount": 868,
    "eventsInRange": 869,
    "userCount": 605,
    "environments": [
      "production",
      "staging"
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
        68,
        93,
        119,
        114,
        63,
        40,
        59,
        86,
        56,
        66,
        105
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 20,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 868
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome 141",
            "count": 421
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 213
          },
          {
            "value": "Edge 141",
            "count": 145
          },
          {
            "value": "Firefox 143",
            "count": 89
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 397
          },
          {
            "value": "Linux",
            "count": 289
          },
          {
            "value": "ChromeOS 141",
            "count": 182
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 414
          },
          {
            "value": "v2.13.0",
            "count": 301
          },
          {
            "value": "v2.12.0",
            "count": 153
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 583
          },
          {
            "value": "staging",
            "count": 285
          }
        ]
      },
      {
        "key": "user",
        "distinct": 605,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 172
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 53
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 24
          },
          {
            "value": "u_00c4e1",
            "count": 11
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-10-03T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-tomasz",
          "name": "Tomasz Wiśniewski-Kowalczyk",
          "email": "tomasz.wisniewski-kowalczyk@outlook.com"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-03T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-63",
    "shortId": "HARB-CM",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "Failed to load script: https://maps.googleapis.com/maps/js?callback=initMap&libraries=places",
    "culprit": "components/VenueMap.tsx",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-06T09:12:00Z",
    "lastSeen": "2026-10-11T10:32:00Z",
    "eventCount": 313,
    "eventsInRange": 312,
    "userCount": 118,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        6,
        11,
        11,
        11,
        15,
        7,
        11,
        10,
        9,
        13,
        10,
        10,
        16,
        7,
        10,
        7,
        12,
        11,
        5,
        8,
        12,
        9,
        7,
        16,
        16,
        12,
        16,
        7,
        10,
        7
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 37,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 313
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 213
          },
          {
            "value": "Edge 141",
            "count": 49
          },
          {
            "value": "Chrome Mobile 141",
            "count": 25
          },
          {
            "value": "Safari 26.0",
            "count": 26
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 150
          },
          {
            "value": "Linux",
            "count": 111
          },
          {
            "value": "iOS 18.6.2",
            "count": 52
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 186
          },
          {
            "value": "v2.13.0",
            "count": 62
          },
          {
            "value": "v2.12.0",
            "count": 65
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 192
          },
          {
            "value": "staging",
            "count": 121
          }
        ]
      },
      {
        "key": "user",
        "distinct": 118,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 49
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 32
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 9
          },
          {
            "value": "u_00c4e1",
            "count": 4
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-11T12:32:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-06T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-64",
    "shortId": "HARB-CT",
    "projectId": "p-harbour",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "events",
      "total": 100,
      "remaining": 40
    },
    "assignee": null,
    "firstSeen": "2026-08-26T09:12:00Z",
    "lastSeen": "2026-10-10T05:56:00Z",
    "eventCount": 71,
    "eventsInRange": 72,
    "userCount": 27,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        3,
        3,
        4,
        3,
        2,
        3,
        2,
        1,
        3,
        2,
        3,
        4,
        3,
        2,
        3,
        2,
        3,
        3,
        2,
        2,
        2,
        2,
        2,
        2,
        3,
        1,
        1,
        2,
        3,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 31,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 71
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Firefox 143",
            "count": 41
          },
          {
            "value": "Chrome Mobile 141",
            "count": 18
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 8
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 4
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 46
          },
          {
            "value": "macOS 15.6",
            "count": 15
          },
          {
            "value": "ChromeOS 141",
            "count": 10
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 46
          },
          {
            "value": "v2.13.0",
            "count": 15
          },
          {
            "value": "v2.12.0",
            "count": 10
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 37
          },
          {
            "value": "staging",
            "count": 34
          }
        ]
      },
      {
        "key": "user",
        "distinct": 27,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 12
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 6
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-10T07:56:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "events",
          "total": 100,
          "remaining": 40
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-26T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-65",
    "shortId": "HARB-D0",
    "projectId": "p-harbour",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "warning",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-18T09:12:00Z",
    "lastSeen": "2026-10-08T20:15:00Z",
    "eventCount": 325,
    "eventsInRange": 323,
    "userCount": 112,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        13,
        5,
        10,
        10,
        13,
        14,
        11,
        5,
        5,
        15,
        8,
        13,
        11,
        8,
        8,
        10,
        15,
        15,
        13,
        10,
        14,
        12,
        10,
        6,
        5,
        14,
        15,
        15,
        11,
        9
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 25,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 325
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 228
          },
          {
            "value": "Safari 26.0",
            "count": 69
          },
          {
            "value": "Firefox 143",
            "count": 19
          },
          {
            "value": "Samsung Internet 28",
            "count": 9
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Windows 11",
            "count": 170
          },
          {
            "value": "Android 15",
            "count": 114
          },
          {
            "value": "iOS 18.6.2",
            "count": 41
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 179
          },
          {
            "value": "v2.13.0",
            "count": 70
          },
          {
            "value": "v2.12.0",
            "count": 76
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 196
          },
          {
            "value": "staging",
            "count": 129
          }
        ]
      },
      {
        "key": "user",
        "distinct": 112,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 48
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 29
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 15
          },
          {
            "value": "u_00c4e1",
            "count": 6
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-08T21:15:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-18T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-66",
    "shortId": "HARB-D7",
    "projectId": "p-harbour",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-01T09:12:00Z",
    "lastSeen": "2026-10-13T06:29:00Z",
    "eventCount": 18,
    "eventsInRange": 21,
    "userCount": 8,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 18,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 18
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome 141",
            "count": 13
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 3
          },
          {
            "value": "Edge 141",
            "count": 1
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 9
          },
          {
            "value": "Windows 11",
            "count": 6
          },
          {
            "value": "Linux",
            "count": 3
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 11
          },
          {
            "value": "v2.13.0",
            "count": 3
          },
          {
            "value": "v2.12.0",
            "count": 4
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 11
          },
          {
            "value": "staging",
            "count": 7
          }
        ]
      },
      {
        "key": "user",
        "distinct": 8,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 3
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-01T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-67",
    "shortId": "HARB-DE",
    "projectId": "p-harbour",
    "type": "TypeError",
    "message": "Cannot set properties of undefined (setting 'quantity')",
    "culprit": "lib/basket/reducer.ts in basketReducer",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-14T09:12:00Z",
    "lastSeen": "2026-10-07T17:15:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-14T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-68",
    "shortId": "HARB-DL",
    "projectId": "p-harbour",
    "type": "AbortError",
    "message": "The operation was aborted.",
    "culprit": "hooks/useSearch.ts in useSearch",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-28T09:12:00Z",
    "lastSeen": "2026-10-13T08:58:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 3
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Android 15",
            "count": 3
          },
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 2
          },
          {
            "value": "v2.13.0",
            "count": 1
          },
          {
            "value": "v2.12.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 3
          },
          {
            "value": "staging",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-28T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
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
    "eventsInRange": 489,
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
    "isRegression": false,
    "firstRelease": "v2.9.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 14,
        "values": [
          {
            "value": "https://book.harbourdental.co.uk/",
            "count": 488
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Chrome 141",
            "count": 347
          },
          {
            "value": "Safari 26.0",
            "count": 103
          },
          {
            "value": "Firefox 143",
            "count": 25
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 13
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 329
          },
          {
            "value": "Android 15",
            "count": 107
          },
          {
            "value": "macOS 15.6",
            "count": 52
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v2.14.0",
            "count": 341
          },
          {
            "value": "v2.13.0",
            "count": 108
          },
          {
            "value": "v2.12.0",
            "count": 39
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 334
          },
          {
            "value": "staging",
            "count": 154
          }
        ]
      },
      {
        "key": "user",
        "distinct": 127,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 94
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 30
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 15
          },
          {
            "value": "u_00c4e1",
            "count": 7
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-09T09:12:00Z",
        "release": "v2.9.0"
      }
    ]
  },
  {
    "id": "i-70",
    "shortId": "MOSS-DZ",
    "projectId": "p-moss",
    "type": "Error",
    "message": "Failed to load script: https://maps.googleapis.com/maps/js?callback=initMap&libraries=places",
    "culprit": "components/VenueMap.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-24T09:12:00Z",
    "lastSeen": "2026-10-11T22:34:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 9,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-24T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-71",
    "shortId": "MOSS-E6",
    "projectId": "p-moss",
    "type": "Error",
    "message": "connect ECONNREFUSED 10.0.3.12:5432",
    "culprit": "lib/db/pool.ts in connect",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-09T09:12:00Z",
    "lastSeen": "2026-10-12T07:31:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-12T09:31:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-09T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
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
    "eventsInRange": 59,
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
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 39,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 59
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 30
          },
          {
            "value": "Chrome 141",
            "count": 16
          },
          {
            "value": "Samsung Internet 28",
            "count": 7
          },
          {
            "value": "Safari 26.0",
            "count": 6
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 44
          },
          {
            "value": "iOS 18.6.2",
            "count": 10
          },
          {
            "value": "macOS 15.6",
            "count": 5
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 28
          },
          {
            "value": "v3.8.0",
            "count": 23
          },
          {
            "value": "v3.7.2",
            "count": 8
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 59
          }
        ]
      },
      {
        "key": "user",
        "distinct": 23,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 12
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 3
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 2
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-08T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
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
    "eventsInRange": 46,
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
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 9,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 46
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Edge 141",
            "count": 29
          },
          {
            "value": "Firefox 143",
            "count": 8
          },
          {
            "value": "Samsung Internet 28",
            "count": 6
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 3
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 22
          },
          {
            "value": "Windows 11",
            "count": 13
          },
          {
            "value": "macOS 15.6",
            "count": 11
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 30
          },
          {
            "value": "v3.8.0",
            "count": 10
          },
          {
            "value": "v3.7.2",
            "count": 6
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 46
          }
        ]
      },
      {
        "key": "user",
        "distinct": 16,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 10
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 3
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-07T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-74",
    "shortId": "MOSS-ER",
    "projectId": "p-moss",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-21T09:12:00Z",
    "lastSeen": "2026-10-07T21:13:00Z",
    "eventCount": 11,
    "eventsInRange": 2,
    "userCount": 5,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 11,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 11
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Edge 141",
            "count": 6
          },
          {
            "value": "Chrome 141",
            "count": 4
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Windows 11",
            "count": 8
          },
          {
            "value": "iOS 18.6.2",
            "count": 2
          },
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 8
          },
          {
            "value": "v3.8.0",
            "count": 2
          },
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 11
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-21T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-75",
    "shortId": "MOSS-EY",
    "projectId": "p-moss",
    "type": "AbortError",
    "message": "The operation was aborted.",
    "culprit": "hooks/useSearch.ts in useSearch",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-01T09:12:00Z",
    "lastSeen": "2026-10-08T16:36:00Z",
    "eventCount": 15,
    "eventsInRange": 15,
    "userCount": 10,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        1,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 15,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 15
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 8
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 4
          },
          {
            "value": "Safari 26.0",
            "count": 2
          },
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Android 15",
            "count": 9
          },
          {
            "value": "ChromeOS 141",
            "count": 3
          },
          {
            "value": "Windows 11",
            "count": 3
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 10
          },
          {
            "value": "v3.8.0",
            "count": 3
          },
          {
            "value": "v3.7.2",
            "count": 2
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 15
          }
        ]
      },
      {
        "key": "user",
        "distinct": 10,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 3
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-01T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-76",
    "shortId": "MOSS-F5",
    "projectId": "p-moss",
    "type": "TypeError",
    "message": "Load failed",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-16T09:12:00Z",
    "lastSeen": "2026-10-08T13:41:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-16T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-77",
    "shortId": "MOSS-FC",
    "projectId": "p-moss",
    "type": "TypeError",
    "message": "Cannot set properties of undefined (setting 'quantity')",
    "culprit": "lib/basket/reducer.ts in basketReducer",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-12T09:12:00Z",
    "lastSeen": "2026-10-11T07:19:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-12T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-78",
    "shortId": "MOSS-FJ",
    "projectId": "p-moss",
    "type": "Error",
    "message": "timeout of 10000ms exceeded",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "events",
      "total": 100,
      "remaining": 97
    },
    "assignee": null,
    "firstSeen": "2026-10-03T09:12:00Z",
    "lastSeen": "2026-10-07T10:59:00Z",
    "eventCount": 13,
    "eventsInRange": 12,
    "userCount": 3,
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
        2,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 8,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 13
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 8
          },
          {
            "value": "Samsung Internet 28",
            "count": 3
          },
          {
            "value": "Edge 141",
            "count": 1
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 7
          },
          {
            "value": "ChromeOS 141",
            "count": 4
          },
          {
            "value": "Windows 11",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 6
          },
          {
            "value": "v3.8.0",
            "count": 4
          },
          {
            "value": "v3.7.2",
            "count": 3
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 13
          }
        ]
      },
      {
        "key": "user",
        "distinct": 3,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-07T12:59:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "events",
          "total": 100,
          "remaining": 97
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-03T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-79",
    "shortId": "MOSS-FQ",
    "projectId": "p-moss",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-23T09:12:00Z",
    "lastSeen": "2026-10-09T14:05:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome 141",
            "count": 2
          },
          {
            "value": "Safari 26.0",
            "count": 1
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 3
          },
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 2
          },
          {
            "value": "v3.8.0",
            "count": 1
          },
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-23T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-80",
    "shortId": "MOSS-FX",
    "projectId": "p-moss",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-03T09:12:00Z",
    "lastSeen": "2026-10-07T20:28:00Z",
    "eventCount": 3,
    "eventsInRange": 3,
    "userCount": 1,
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
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 3,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 3
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 8,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 2
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "iOS 26.0.1",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 2
          },
          {
            "value": "v3.8.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 3
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-07T21:28:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-03T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-81",
    "shortId": "MOSS-G4",
    "projectId": "p-moss",
    "type": "SecurityError",
    "message": "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
    "culprit": "lib/basket/persist.ts in loadBasket",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-06T09:12:00Z",
    "lastSeen": "2026-10-07T21:18:00Z",
    "eventCount": 10,
    "eventsInRange": 11,
    "userCount": 6,
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
        2,
        1,
        1,
        1,
        2,
        1,
        2,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 10,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 10
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Firefox 143",
            "count": 5
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 4
          },
          {
            "value": "Samsung Internet 28",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Linux",
            "count": 5
          },
          {
            "value": "Windows 11",
            "count": 3
          },
          {
            "value": "macOS 15.6",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 7
          },
          {
            "value": "v3.8.0",
            "count": 2
          },
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 10
          }
        ]
      },
      {
        "key": "user",
        "distinct": 6,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-06T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-82",
    "shortId": "MOSS-GB",
    "projectId": "p-moss",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-07-26T09:12:00Z",
    "lastSeen": "2026-10-09T13:22:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-07-26T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-83",
    "shortId": "MOSS-GI",
    "projectId": "p-moss",
    "type": "TypeError",
    "message": "NetworkError when attempting to fetch resource.",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-10-05T09:12:00Z",
    "lastSeen": "2026-10-07T11:08:00Z",
    "eventCount": 18,
    "eventsInRange": 18,
    "userCount": 9,
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
        1,
        2,
        1,
        2,
        2,
        2,
        3,
        3,
        2
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 18,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 18
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Chrome 141",
            "count": 9
          },
          {
            "value": "Edge 141",
            "count": 6
          },
          {
            "value": "Facebook in-app (iOS)",
            "count": 2
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Linux",
            "count": 9
          },
          {
            "value": "macOS 15.6",
            "count": 6
          },
          {
            "value": "iOS 18.6.2",
            "count": 3
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 8
          },
          {
            "value": "v3.8.0",
            "count": 5
          },
          {
            "value": "v3.7.2",
            "count": 5
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 18
          }
        ]
      },
      {
        "key": "user",
        "distinct": 9,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 3
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-10-05T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-05T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-84",
    "shortId": "MOSS-GP",
    "projectId": "p-moss",
    "type": "TypeError",
    "message": "Cannot set properties of undefined (setting 'quantity')",
    "culprit": "lib/basket/reducer.ts in basketReducer",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-08T09:12:00Z",
    "lastSeen": "2026-10-09T17:07:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 3,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-08T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-85",
    "shortId": "MOSS-GW",
    "projectId": "p-moss",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "until",
      "until": "2026-10-22T09:12:00Z"
    },
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-10-09T21:33:00Z",
    "eventCount": 6,
    "eventsInRange": 6,
    "userCount": 3,
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
        6,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "v3.6.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 6,
        "values": [
          {
            "value": "https://enquiries.mossgrovehall.co.uk/",
            "count": 6
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 10,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 3
          },
          {
            "value": "Chrome 141",
            "count": 2
          },
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 3,
        "values": [
          {
            "value": "iOS 26.0.1",
            "count": 4
          },
          {
            "value": "ChromeOS 141",
            "count": 1
          },
          {
            "value": "macOS 15.6",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "v3.8.1",
            "count": 3
          },
          {
            "value": "v3.8.0",
            "count": 2
          },
          {
            "value": "v3.7.2",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 6
          }
        ]
      },
      {
        "key": "user",
        "distinct": 3,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-09T23:33:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "until",
          "until": "2026-10-22T09:12:00Z"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "v3.6.0"
      }
    ]
  },
  {
    "id": "i-86",
    "shortId": "ALOT-H3",
    "projectId": "p-allot",
    "type": "ReferenceError",
    "message": "gtag is not defined",
    "culprit": "app/layout.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-08-07T09:12:00Z",
    "lastSeen": "2026-10-11T13:21:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-08-07T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-07T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-87",
    "shortId": "ALOT-HA",
    "projectId": "p-allot",
    "type": "TypeError",
    "message": "Load failed",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-05T09:12:00Z",
    "lastSeen": "2026-10-13T07:48:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "4ca9c53",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-05T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-88",
    "shortId": "ALOT-HH",
    "projectId": "p-allot",
    "type": "SyntaxError",
    "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    "culprit": "lib/api/client.ts in parseJson",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-13T09:12:00Z",
    "lastSeen": "2026-10-11T03:37:00Z",
    "eventCount": 7,
    "eventsInRange": 7,
    "userCount": 4,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        7,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 7,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 7
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 4,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 5
          },
          {
            "value": "Samsung Internet 28",
            "count": 1
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "macOS 15.6",
            "count": 4
          },
          {
            "value": "iOS 26.0.1",
            "count": 2
          },
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 5
          },
          {
            "value": "4ca9c53",
            "count": 1
          },
          {
            "value": "2fd10a5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 5
          },
          {
            "value": "development",
            "count": 2
          }
        ]
      },
      {
        "key": "user",
        "distinct": 4,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-13T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-89",
    "shortId": "ALOT-HO",
    "projectId": "p-allot",
    "type": "TypeError",
    "message": "Cannot set properties of undefined (setting 'quantity')",
    "culprit": "lib/basket/reducer.ts in basketReducer",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-08-26T09:12:00Z",
    "lastSeen": "2026-10-11T17:03:00Z",
    "eventCount": 2,
    "eventsInRange": 2,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 2
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "Windows 11",
            "count": 1
          },
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          },
          {
            "value": "4ca9c53",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          },
          {
            "value": "development",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-08-26T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-26T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-90",
    "shortId": "ALOT-HV",
    "projectId": "p-allot",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-12T09:12:00Z",
    "lastSeen": "2026-10-08T23:00:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 8,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Windows 11",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-12T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-91",
    "shortId": "ALOT-I2",
    "projectId": "p-allot",
    "type": "Error",
    "message": "ENOENT: no such file or directory, open '/var/task/content/posts/draft-autumn-planting.md'",
    "culprit": "lib/content/load.ts in loadPost",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-25T09:12:00Z",
    "lastSeen": "2026-10-10T00:35:00Z",
    "eventCount": 37,
    "eventsInRange": 38,
    "userCount": 21,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        1,
        1,
        2,
        1,
        1,
        1,
        1,
        2,
        2,
        1,
        1,
        1,
        1,
        2,
        1,
        1,
        1,
        2,
        1,
        1,
        1,
        1,
        2,
        1,
        1,
        2,
        1,
        2,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 37
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 23
          },
          {
            "value": "Mobile Safari 26.0",
            "count": 9
          },
          {
            "value": "Chrome 141",
            "count": 3
          },
          {
            "value": "Samsung Internet 28",
            "count": 2
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Android 15",
            "count": 24
          },
          {
            "value": "iOS 26.0.1",
            "count": 7
          },
          {
            "value": "Windows 11",
            "count": 6
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 22
          },
          {
            "value": "4ca9c53",
            "count": 9
          },
          {
            "value": "2fd10a5",
            "count": 6
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 19
          },
          {
            "value": "development",
            "count": 18
          }
        ]
      },
      {
        "key": "user",
        "distinct": 21,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 7
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 2
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-25T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-92",
    "shortId": "ALOT-I9",
    "projectId": "p-allot",
    "type": "Error",
    "message": "Request failed with status code 429",
    "culprit": "lib/shipping/quote.ts in getQuote",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-10-02T09:12:00Z",
    "lastSeen": "2026-10-11T06:37:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 1,
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
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Chrome 141",
            "count": 2
          },
          {
            "value": "Edge 141",
            "count": 1
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Android 15",
            "count": 2
          },
          {
            "value": "iOS 26.0.1",
            "count": 1
          },
          {
            "value": "Windows 11",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 2
          },
          {
            "value": "4ca9c53",
            "count": 1
          },
          {
            "value": "2fd10a5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 3
          },
          {
            "value": "development",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-10-02T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-02T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-93",
    "shortId": "ALOT-IG",
    "projectId": "p-allot",
    "type": "Error",
    "message": "Request failed with status code 429",
    "culprit": "lib/shipping/quote.ts in getQuote",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-06T09:12:00Z",
    "lastSeen": "2026-10-11T18:22:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-11T19:22:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-10-06T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-94",
    "shortId": "ALOT-IN",
    "projectId": "p-allot",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "components/Price.tsx in Price",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-27T09:12:00Z",
    "lastSeen": "2026-10-11T21:21:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 4,
        "values": [
          {
            "value": "Windows 11",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "development",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-11T22:21:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-27T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-95",
    "shortId": "ALOT-IU",
    "projectId": "p-allot",
    "type": "TypeError",
    "message": "undefined is not an object (evaluating 'window.dataLayer.push')",
    "culprit": "components/Analytics.tsx",
    "level": "error",
    "status": "resolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-10T09:12:00Z",
    "lastSeen": "2026-10-07T11:53:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "resolved",
        "at": "2026-10-07T12:53:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-10T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-96",
    "shortId": "ALOT-J1",
    "projectId": "p-allot",
    "type": "Error",
    "message": "Failed to load script: https://maps.googleapis.com/maps/js?callback=initMap&libraries=places",
    "culprit": "components/VenueMap.tsx",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-06T09:12:00Z",
    "lastSeen": "2026-10-12T23:28:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production",
      "development"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 11,
        "values": [
          {
            "value": "Mobile Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 6,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-06T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-97",
    "shortId": "ALOT-J8",
    "projectId": "p-allot",
    "type": "Error",
    "message": "ENOENT: no such file or directory, open '/var/task/content/posts/draft-autumn-planting.md'",
    "culprit": "lib/content/load.ts in loadPost",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-18T09:12:00Z",
    "lastSeen": "2026-10-08T21:59:00Z",
    "eventCount": 46,
    "eventsInRange": 44,
    "userCount": 29,
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
        1,
        2,
        2,
        1,
        3,
        3,
        1,
        2,
        2,
        1,
        1,
        2,
        1,
        1,
        1,
        2,
        1,
        3,
        2,
        3,
        1,
        1,
        3,
        1,
        2,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "17e88cb",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 11,
        "values": [
          {
            "value": "https://plot.sundial.dev/",
            "count": 46
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Edge 141",
            "count": 29
          },
          {
            "value": "Firefox 143",
            "count": 9
          },
          {
            "value": "Chrome Mobile 141",
            "count": 5
          },
          {
            "value": "Samsung Internet 28",
            "count": 3
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "ChromeOS 141",
            "count": 25
          },
          {
            "value": "Android 15",
            "count": 12
          },
          {
            "value": "iOS 26.0.1",
            "count": 9
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "27a7795",
            "count": 24
          },
          {
            "value": "4ca9c53",
            "count": 10
          },
          {
            "value": "2fd10a5",
            "count": 12
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 2,
        "values": [
          {
            "value": "production",
            "count": 22
          },
          {
            "value": "development",
            "count": 24
          }
        ]
      },
      {
        "key": "user",
        "distinct": 29,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 9
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 3
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-18T09:12:00Z",
        "release": "17e88cb"
      }
    ]
  },
  {
    "id": "i-98",
    "shortId": "TIDE-JF",
    "projectId": "p-tides",
    "type": "AbortError",
    "message": "The operation was aborted.",
    "culprit": "hooks/useSearch.ts in useSearch",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-14T09:12:00Z",
    "lastSeen": "2026-10-10T19:10:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-14T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-99",
    "shortId": "TIDE-JM",
    "projectId": "p-tides",
    "type": "TypeError",
    "message": "Cannot read properties of null (reading 'getBoundingClientRect')",
    "culprit": "src/handler.ts",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-09-29T09:12:00Z",
    "lastSeen": "2026-10-13T00:11:00Z",
    "eventCount": 54,
    "eventsInRange": 55,
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
        4,
        3,
        2,
        3,
        2,
        5,
        4,
        5,
        3,
        5,
        3,
        4,
        3,
        5,
        4
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 24,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 54
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 29
          },
          {
            "value": "ac64da3",
            "count": 19
          },
          {
            "value": "4c94515",
            "count": 6
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 54
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-09-29T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-29T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-100",
    "shortId": "TIDE-JT",
    "projectId": "p-tides",
    "type": "TypeError",
    "message": "NetworkError when attempting to fetch resource.",
    "culprit": "lib/api/client.ts in request",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-07-29T09:12:00Z",
    "lastSeen": "2026-10-11T22:19:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-07-29T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-101",
    "shortId": "TIDE-K0",
    "projectId": "p-tides",
    "type": "TypeError",
    "message": "e.toFixed is not a function",
    "culprit": "chunks/4410-91be2d.js in a",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "until",
      "until": "2026-10-21T09:12:00Z"
    },
    "assignee": null,
    "firstSeen": "2026-09-17T09:12:00Z",
    "lastSeen": "2026-10-11T22:51:00Z",
    "eventCount": 2,
    "eventsInRange": 2,
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
        2,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 2,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 1
          },
          {
            "value": "ac64da3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 2
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-12T00:51:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "until",
          "until": "2026-10-21T09:12:00Z"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-17T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-102",
    "shortId": "TIDE-K7",
    "projectId": "p-tides",
    "type": "SyntaxError",
    "message": "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON",
    "culprit": "lib/api/client.ts in parseJson",
    "level": "error",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-08T09:12:00Z",
    "lastSeen": "2026-10-13T06:09:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 4
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 3
          },
          {
            "value": "ac64da3",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-13T08:09:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-08T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-103",
    "shortId": "TIDE-KE",
    "projectId": "p-tides",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "warning",
    "status": "ignored",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-10T09:12:00Z",
    "lastSeen": "2026-10-07T10:56:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "f581a71",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://tides.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 4,
        "values": [
          {
            "value": "ca4fda5",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "ignored",
        "at": "2026-10-07T12:56:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-08-10T09:12:00Z",
        "release": "f581a71"
      }
    ]
  },
  {
    "id": "i-104",
    "shortId": "AIDN-KL",
    "projectId": "p-parish",
    "type": "SecurityError",
    "message": "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
    "culprit": "lib/basket/persist.ts in loadBasket",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-28T09:12:00Z",
    "lastSeen": "2026-10-13T01:12:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "1.3.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://staidans-whitby.org.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Samsung Internet 28",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "1.4.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-28T09:12:00Z",
        "release": "1.3.0"
      }
    ]
  },
  {
    "id": "i-105",
    "shortId": "AIDN-KS",
    "projectId": "p-parish",
    "type": "TypeError",
    "message": "Failed to construct 'URL': Invalid URL",
    "culprit": "lib/links.ts in absoluteUrl",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": {
      "id": "m-owner",
      "name": "Charles",
      "email": "hello@sundial.dev"
    },
    "firstSeen": "2026-09-26T09:12:00Z",
    "lastSeen": "2026-10-11T18:28:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "1.3.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://staidans-whitby.org.uk/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 7,
        "values": [
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "1.4.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "assigned",
        "at": "2026-09-26T12:12:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "to": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-26T09:12:00Z",
        "release": "1.3.0"
      }
    ]
  },
  {
    "id": "i-106",
    "shortId": "AIDN-KZ",
    "projectId": "p-parish",
    "type": "UnhandledRejection",
    "message": "Non-Error promise rejection captured with value: undefined",
    "culprit": null,
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-02T09:12:00Z",
    "lastSeen": "2026-10-10T06:48:00Z",
    "eventCount": 9,
    "eventsInRange": 10,
    "userCount": 4,
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
        1,
        1,
        1,
        1,
        1,
        1,
        0,
        1,
        0,
        1,
        1,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "1.3.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 9,
        "values": [
          {
            "value": "https://staidans-whitby.org.uk/",
            "count": 9
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Chrome 141",
            "count": 4
          },
          {
            "value": "Edge 141",
            "count": 2
          },
          {
            "value": "Firefox 143",
            "count": 2
          },
          {
            "value": "Safari 26.0",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Android 15",
            "count": 5
          },
          {
            "value": "Windows 11",
            "count": 3
          },
          {
            "value": "ChromeOS 141",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "1.4.0",
            "count": 5
          },
          {
            "value": "1.3.0",
            "count": 4
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 9
          }
        ]
      },
      {
        "key": "user",
        "distinct": 4,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-02T09:12:00Z",
        "release": "1.3.0"
      }
    ]
  },
  {
    "id": "i-107",
    "shortId": "AIDN-L6",
    "projectId": "p-parish",
    "type": "AbortError",
    "message": "The operation was aborted.",
    "culprit": "hooks/useSearch.ts in useSearch",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-08-14T09:12:00Z",
    "lastSeen": "2026-10-13T03:39:00Z",
    "eventCount": 14,
    "eventsInRange": 11,
    "userCount": 5,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        1,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "1.3.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 14,
        "values": [
          {
            "value": "https://staidans-whitby.org.uk/",
            "count": 14
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 8,
        "values": [
          {
            "value": "Safari 26.0",
            "count": 8
          },
          {
            "value": "Edge 141",
            "count": 4
          },
          {
            "value": "Samsung Internet 28",
            "count": 1
          },
          {
            "value": "Chrome 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 5,
        "values": [
          {
            "value": "Linux",
            "count": 8
          },
          {
            "value": "macOS 15.6",
            "count": 4
          },
          {
            "value": "Android 15",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "1.4.0",
            "count": 9
          },
          {
            "value": "1.3.0",
            "count": 5
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 14
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 2
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "anonymous (82.132.x.x)",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-08-14T09:12:00Z",
        "release": "1.3.0"
      }
    ]
  },
  {
    "id": "i-108",
    "shortId": "FLDN-LD",
    "projectId": "p-field",
    "type": "SecurityError",
    "message": "Failed to read the 'localStorage' property from 'Window': Access is denied for this document.",
    "culprit": "lib/basket/persist.ts in loadBasket",
    "level": "warning",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-21T09:12:00Z",
    "lastSeen": "2026-10-10T14:09:00Z",
    "eventCount": 16,
    "eventsInRange": 16,
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
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        1,
        0,
        1,
        1,
        1
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "5f76e86",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 16,
        "values": [
          {
            "value": "https://fieldnotes.sundial.dev/",
            "count": 16
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 6,
        "values": [
          {
            "value": "Facebook in-app (iOS)",
            "count": 7
          },
          {
            "value": "Safari 26.0",
            "count": 7
          },
          {
            "value": "Chrome 141",
            "count": 1
          },
          {
            "value": "Edge 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Windows 11",
            "count": 11
          },
          {
            "value": "Android 15",
            "count": 3
          },
          {
            "value": "iOS 26.0.1",
            "count": 2
          }
        ]
      },
      {
        "key": "release",
        "distinct": 3,
        "values": [
          {
            "value": "8cddf58",
            "count": 9
          },
          {
            "value": "2177c9c",
            "count": 4
          },
          {
            "value": "5f76e86",
            "count": 3
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 16
          }
        ]
      },
      {
        "key": "user",
        "distinct": 5,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 3
          },
          {
            "value": "jo.marsh@btinternet.com",
            "count": 1
          },
          {
            "value": "u_00c4e1",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-21T09:12:00Z",
        "release": "5f76e86"
      }
    ]
  },
  {
    "id": "i-109",
    "shortId": "FLDN-LK",
    "projectId": "p-field",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-10-05T09:12:00Z",
    "lastSeen": "2026-10-10T19:05:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 1,
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
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "5f76e86",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "https://fieldnotes.sundial.dev/",
            "count": 1
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 2,
        "values": [
          {
            "value": "Firefox 143",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 7,
        "values": [
          {
            "value": "Android 15",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 3,
        "values": [
          {
            "value": "5f76e86",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 1,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-10-05T09:12:00Z",
        "release": "5f76e86"
      }
    ]
  },
  {
    "id": "i-110",
    "shortId": "FLDN-LR",
    "projectId": "p-field",
    "type": "Error",
    "message": "Invalid postcode: \"YO21 3\"",
    "culprit": "lib/shipping/validatePostcode.ts",
    "level": "error",
    "status": "unresolved",
    "snooze": null,
    "assignee": null,
    "firstSeen": "2026-09-14T09:12:00Z",
    "lastSeen": "2026-10-10T04:04:00Z",
    "eventCount": 4,
    "eventsInRange": 4,
    "userCount": 3,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "5f76e86",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 4,
        "values": [
          {
            "value": "https://fieldnotes.sundial.dev/",
            "count": 4
          }
        ]
      },
      {
        "key": "browser",
        "distinct": 5,
        "values": [
          {
            "value": "Edge 141",
            "count": 3
          },
          {
            "value": "Chrome Mobile 141",
            "count": 1
          }
        ]
      },
      {
        "key": "os",
        "distinct": 2,
        "values": [
          {
            "value": "iOS 18.6.2",
            "count": 2
          },
          {
            "value": "Windows 11",
            "count": 1
          },
          {
            "value": "Linux",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 3,
        "values": [
          {
            "value": "8cddf58",
            "count": 2
          },
          {
            "value": "2177c9c",
            "count": 1
          },
          {
            "value": "5f76e86",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 4
          }
        ]
      },
      {
        "key": "user",
        "distinct": 3,
        "values": [
          {
            "value": "u_8f2a19",
            "count": 1
          }
        ]
      }
    ],
    "activity": [
      {
        "kind": "first_seen",
        "at": "2026-09-14T09:12:00Z",
        "release": "5f76e86"
      }
    ]
  },
  {
    "id": "i-111",
    "shortId": "INVC-LY",
    "projectId": "p-invoice",
    "type": "Error",
    "message": "Text content does not match server-rendered HTML.",
    "culprit": "src/handler.ts",
    "level": "error",
    "status": "snoozed",
    "snooze": {
      "kind": "until",
      "until": "2026-10-24T09:12:00Z"
    },
    "assignee": null,
    "firstSeen": "2026-09-07T09:12:00Z",
    "lastSeen": "2026-10-10T15:36:00Z",
    "eventCount": 1,
    "eventsInRange": 1,
    "userCount": 0,
    "environments": [
      "production"
    ],
    "trend": {
      "bucket": "day",
      "start": "2026-09-14T00:00:00Z",
      "counts": [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    "isNew": false,
    "isRegression": false,
    "firstRelease": "0.8.0",
    "regressedIn": null,
    "tags": [
      {
        "key": "url",
        "distinct": 1,
        "values": [
          {
            "value": "worker",
            "count": 1
          }
        ]
      },
      {
        "key": "release",
        "distinct": 2,
        "values": [
          {
            "value": "0.9.0",
            "count": 1
          }
        ]
      },
      {
        "key": "environment",
        "distinct": 1,
        "values": [
          {
            "value": "production",
            "count": 1
          }
        ]
      },
      {
        "key": "user",
        "distinct": 0,
        "values": []
      }
    ],
    "activity": [
      {
        "kind": "snoozed",
        "at": "2026-10-10T17:36:00Z",
        "by": {
          "id": "m-owner",
          "name": "Charles",
          "email": "hello@sundial.dev"
        },
        "snooze": {
          "kind": "until",
          "until": "2026-10-24T09:12:00Z"
        }
      },
      {
        "kind": "first_seen",
        "at": "2026-09-07T09:12:00Z",
        "release": "0.8.0"
      }
    ]
  }
]
