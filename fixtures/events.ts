// Generated fixture — invented data with realistic shape.
import type { Event } from "../src/contract/domain"

export const events: Event[] = [
  {
    "id": "e-cart-1",
    "issueId": "i-cart-map",
    "receivedAt": "2026-10-13T09:09:00Z",
    "release": "2026.10.12-1",
    "environment": "production",
    "level": "error",
    "exception": {
      "type": "TypeError",
      "message": "Cannot read properties of undefined (reading 'map')",
      "frames": [
        {
          "file": "components/cart/CartDrawer.tsx",
          "function": "CartDrawer",
          "line": 48,
          "column": 31,
          "inApp": true,
          "mapped": true,
          "context": {
            "startLine": 43,
            "highlight": 48,
            "lines": [
              "  const { data: basket, isLoading } = useBasket()",
              "  const total = useMemo(() => sumLines(basket?.items), [basket])",
              "",
              "  if (isLoading) return <DrawerSkeleton />",
              "",
              "  const lines = basket.items.map((item) => (",
              "    <CartLine key={item.sku} item={item} onRemove={remove} />",
              "  ))",
              "",
              "  return (",
              "    <Drawer open={open} onClose={onClose} title=\"Your basket\">"
            ]
          }
        },
        {
          "file": "components/cart/CartProvider.tsx",
          "function": "CartProvider",
          "line": 112,
          "column": 9,
          "inApp": true,
          "mapped": true,
          "context": {
            "startLine": 108,
            "highlight": 112,
            "lines": [
              "  return (",
              "    <CartContext.Provider value={value}>",
              "      {children}",
              "      {/* drawer is mounted once at the root */}",
              "      <CartDrawer open={drawerOpen} onClose={closeDrawer} />",
              "    </CartContext.Provider>",
              "  )"
            ]
          }
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderWithHooks",
          "line": 6788,
          "column": 57,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "updateFunctionComponent",
          "line": 9719,
          "column": 65,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "beginWork",
          "line": 9241,
          "column": 76,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performUnitOfWork",
          "line": 8472,
          "column": 55,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "workLoopSync",
          "line": 8177,
          "column": 3,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderRootSync",
          "line": 5487,
          "column": 50,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "recoverFromConcurrentError",
          "line": 9241,
          "column": 44,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performSyncWorkOnRoot",
          "line": 6188,
          "column": 75,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "flushSyncCallbacks",
          "line": 9519,
          "column": 24,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "commitRootImpl",
          "line": 5991,
          "column": 3,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "processRootScheduleInMicrotask",
          "line": 10304,
          "column": 25,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "scheduleUpdateOnFiber",
          "line": 7291,
          "column": 78,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "dispatchSetState",
          "line": 11043,
          "column": 71,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "batchedUpdates$1",
          "line": 8878,
          "column": 80,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "app/(shop)/layout.tsx",
          "function": "ShopLayout",
          "line": 22,
          "column": 7,
          "inApp": true,
          "mapped": true,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c6bdf9dc609.js",
          "function": "a",
          "line": 1,
          "column": 88981,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c7d0c6fbf68.js",
          "function": "Ws",
          "line": 1,
          "column": 49557,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2caa04385fe5.js",
          "function": "Ws",
          "line": 1,
          "column": 37551,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c2be1036f73.js",
          "function": "a",
          "line": 1,
          "column": 130132,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c4c3d2e3b5c.js",
          "function": "Rc",
          "line": 1,
          "column": 113499,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cdad5dc6137.js",
          "function": null,
          "line": 1,
          "column": 122053,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c3b503d2e67.js",
          "function": "ou",
          "line": 1,
          "column": 111857,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cf8fb18910e.js",
          "function": "kl",
          "line": 1,
          "column": 92297,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cf6bf65e6e0.js",
          "function": "Ws",
          "line": 1,
          "column": 94409,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c7d7a8b6ceb.js",
          "function": "Rc",
          "line": 1,
          "column": 104175,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cfbc4e04273.js",
          "function": "Ws",
          "line": 1,
          "column": 119566,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c45ac252179.js",
          "function": "o",
          "line": 1,
          "column": 72998,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c8b00cc80b3.js",
          "function": "kl",
          "line": 1,
          "column": 122911,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c519aea814a.js",
          "function": "kl",
          "line": 1,
          "column": 113482,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2ca269e8e3fe.js",
          "function": "a",
          "line": 1,
          "column": 28013,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c1d16ad4e74.js",
          "function": "Rc",
          "line": 1,
          "column": 11909,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c16880a37b5.js",
          "function": "ou",
          "line": 1,
          "column": 49289,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2ca315075ccb.js",
          "function": "o",
          "line": 1,
          "column": 113679,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c7d773f15be.js",
          "function": "ou",
          "line": 1,
          "column": 102827,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c3ad80d6e30.js",
          "function": "Ws",
          "line": 1,
          "column": 38499,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c695300173f.js",
          "function": "Ws",
          "line": 1,
          "column": 47544,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cdb77ae7ede.js",
          "function": "kl",
          "line": 1,
          "column": 83804,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cbc81a82226.js",
          "function": "Rc",
          "line": 1,
          "column": 25894,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c225150c183.js",
          "function": "kl",
          "line": 1,
          "column": 61371,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cef17db17d5.js",
          "function": "kl",
          "line": 1,
          "column": 105806,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c3159c64a2e.js",
          "function": "kl",
          "line": 1,
          "column": 65952,
          "inApp": false,
          "mapped": false,
          "context": null
        }
      ]
    },
    "breadcrumbs": [
      {
        "at": "2026-10-13T09:03:00Z",
        "category": "navigation",
        "level": "info",
        "message": "/ → /shop/mugs"
      },
      {
        "at": "2026-10-13T09:05:00Z",
        "category": "click",
        "level": "info",
        "message": "button.add-to-basket[data-sku=\"SOM-350\"]"
      },
      {
        "at": "2026-10-13T09:05:00Z",
        "category": "fetch",
        "level": "info",
        "message": "POST /basket/lines 200 (184ms)"
      },
      {
        "at": "2026-10-13T09:07:00Z",
        "category": "navigation",
        "level": "info",
        "message": "/shop/mugs → /products/speckled-oatmeal-mug-350ml?variant=4419"
      },
      {
        "at": "2026-10-13T09:08:00Z",
        "category": "console",
        "level": "warning",
        "message": "[basket] storage event: basket cleared in another tab"
      },
      {
        "at": "2026-10-13T09:08:58Z",
        "category": "click",
        "level": "info",
        "message": "button[aria-label=\"Open basket\"]"
      },
      {
        "at": "2026-10-13T09:08:59.400Z",
        "category": "fetch",
        "level": "info",
        "message": "GET /basket 200 (91ms)"
      }
    ],
    "request": {
      "method": "GET",
      "url": "https://kilnandclay.co.uk/products/speckled-oatmeal-mug-350ml?variant=4419&utm_source=instagram&utm_medium=social&utm_campaign=aw26_launch",
      "status": null
    },
    "user": {
      "id": "u_8f2a19",
      "email": "jo.marsh@btinternet.com",
      "ip": "82.132.214.7"
    },
    "context": {
      "browser": "Mobile Safari 26.0",
      "os": "iOS 26.0.1",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1"
    },
    "tags": {
      "release": "2026.10.12-1",
      "environment": "production",
      "page": "products/[slug]",
      "basket.lines": "0",
      "locale": "en-GB"
    }
  },
  {
    "id": "e-cart-2",
    "issueId": "i-cart-map",
    "receivedAt": "2026-10-13T08:31:00Z",
    "release": "2026.10.12-1",
    "environment": "production",
    "level": "error",
    "exception": {
      "type": "TypeError",
      "message": "Cannot read properties of undefined (reading 'map')",
      "frames": [
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/app/(shop)/layout-1be296b83c6c4508.js",
          "function": "CartDrawer",
          "line": 1,
          "column": 2210,
          "inApp": true,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/app/(shop)/layout-e4bb476ef1dbdaf9.js",
          "function": "CartProvider",
          "line": 1,
          "column": 2247,
          "inApp": true,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c25964ca4e8.js",
          "function": "Rc",
          "line": 1,
          "column": 33090,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c06ff8823c1.js",
          "function": "o",
          "line": 1,
          "column": 75301,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2ce66fdfe1dc.js",
          "function": "kl",
          "line": 1,
          "column": 102164,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cd026abe40d.js",
          "function": "kl",
          "line": 1,
          "column": 50723,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c197fd1d6ac.js",
          "function": "kl",
          "line": 1,
          "column": 80687,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cbb98d66e49.js",
          "function": "a",
          "line": 1,
          "column": 44746,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cb0a050f291.js",
          "function": null,
          "line": 1,
          "column": 89856,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cb8e08d393d.js",
          "function": "ou",
          "line": 1,
          "column": 13650,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c785af94ae3.js",
          "function": null,
          "line": 1,
          "column": 17722,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c74fd07f11f.js",
          "function": null,
          "line": 1,
          "column": 60398,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c35a9d5b224.js",
          "function": "Rc",
          "line": 1,
          "column": 79485,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cdfd36fcde0.js",
          "function": null,
          "line": 1,
          "column": 117385,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c8377b54bcf.js",
          "function": "Ws",
          "line": 1,
          "column": 81551,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c4efd5ec299.js",
          "function": "o",
          "line": 1,
          "column": 23712,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cc09001dc53.js",
          "function": "kl",
          "line": 1,
          "column": 65679,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c8bb7801993.js",
          "function": "Ws",
          "line": 1,
          "column": 62996,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c7ce9d8cb8a.js",
          "function": "a",
          "line": 1,
          "column": 131018,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c9095ac994f.js",
          "function": "kl",
          "line": 1,
          "column": 69267,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c050257e637.js",
          "function": "kl",
          "line": 1,
          "column": 133191,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cc893029e08.js",
          "function": "Rc",
          "line": 1,
          "column": 102780,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c352835e94b.js",
          "function": "ou",
          "line": 1,
          "column": 43082,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cbd88ac10be.js",
          "function": "ou",
          "line": 1,
          "column": 67341,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2ce9cd08242c.js",
          "function": "a",
          "line": 1,
          "column": 19385,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c21922e0f5d.js",
          "function": "Ws",
          "line": 1,
          "column": 30923,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cc0bc766d44.js",
          "function": "Rc",
          "line": 1,
          "column": 20741,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cf9ed26dd9f.js",
          "function": null,
          "line": 1,
          "column": 138068,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2ca1bc6a49e4.js",
          "function": "kl",
          "line": 1,
          "column": 66830,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c464e6d1be6.js",
          "function": "Ws",
          "line": 1,
          "column": 102033,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c6eab29d271.js",
          "function": "o",
          "line": 1,
          "column": 118615,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c528f22c0be.js",
          "function": "ou",
          "line": 1,
          "column": 100487,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c3c9b996bde.js",
          "function": null,
          "line": 1,
          "column": 37647,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c19539f8a52.js",
          "function": "o",
          "line": 1,
          "column": 11281,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c0300b2f4d9.js",
          "function": null,
          "line": 1,
          "column": 31169,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c689f6bfcd5.js",
          "function": null,
          "line": 1,
          "column": 111008,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cfab7b21794.js",
          "function": "Rc",
          "line": 1,
          "column": 133342,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2cf7677f52af.js",
          "function": "Ws",
          "line": 1,
          "column": 30215,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c646fb2eddc.js",
          "function": "a",
          "line": 1,
          "column": 52703,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c80c7b1bd0e.js",
          "function": "ou",
          "line": 1,
          "column": 80977,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c8f1a3e23ee.js",
          "function": "Rc",
          "line": 1,
          "column": 71896,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "https://kilnandclay.co.uk/_next/static/chunks/framework-6f3b2c9e3d908523.js",
          "function": "kl",
          "line": 1,
          "column": 137371,
          "inApp": false,
          "mapped": false,
          "context": null
        }
      ]
    },
    "breadcrumbs": [],
    "request": {
      "method": "GET",
      "url": "https://kilnandclay.co.uk/shop/mugs",
      "status": null
    },
    "user": null,
    "context": {
      "browser": "Facebook in-app (iOS)",
      "os": "iOS 18.6.2",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/512.0.0.41.106;FBBV/731822006;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6.2;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5;FBRV/733104562]"
    },
    "tags": {
      "release": "2026.10.12-1",
      "environment": "production"
    }
  },
  {
    "id": "e-hydration-1",
    "issueId": "i-hydration",
    "receivedAt": "2026-10-13T09:03:00Z",
    "release": "2026.10.12-1",
    "environment": "production",
    "level": "error",
    "exception": {
      "type": "Error",
      "message": "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
      "frames": [
        {
          "file": "components/Price.tsx",
          "function": "Price",
          "line": 14,
          "column": 10,
          "inApp": true,
          "mapped": true,
          "context": {
            "startLine": 10,
            "highlight": 14,
            "lines": [
              "export function Price({ amount }: { amount: number }) {",
              "  // formats in the visitor's locale",
              "  const formatted = new Intl.NumberFormat(undefined, {",
              "    style: \"currency\", currency: \"GBP\",",
              "  }).format(amount / 100)",
              "  return <span className=\"price\">{formatted}</span>",
              "}"
            ]
          }
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderWithHooks",
          "line": 10004,
          "column": 38,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "updateFunctionComponent",
          "line": 11040,
          "column": 37,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "beginWork",
          "line": 7099,
          "column": 43,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performUnitOfWork",
          "line": 5325,
          "column": 43,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "workLoopSync",
          "line": 11266,
          "column": 20,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderRootSync",
          "line": 6714,
          "column": 61,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "recoverFromConcurrentError",
          "line": 7072,
          "column": 4,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performSyncWorkOnRoot",
          "line": 11460,
          "column": 8,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "flushSyncCallbacks",
          "line": 12716,
          "column": 46,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "commitRootImpl",
          "line": 9733,
          "column": 56,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "processRootScheduleInMicrotask",
          "line": 9913,
          "column": 62,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "scheduleUpdateOnFiber",
          "line": 5198,
          "column": 18,
          "inApp": false,
          "mapped": true,
          "context": null
        }
      ]
    },
    "breadcrumbs": [
      {
        "at": "2026-10-13T09:02:00Z",
        "category": "navigation",
        "level": "info",
        "message": "(initial load) /products/hand-thrown-serving-bowl-large"
      }
    ],
    "request": {
      "method": "GET",
      "url": "https://kilnandclay.co.uk/products/hand-thrown-serving-bowl-large",
      "status": null
    },
    "user": {
      "id": null,
      "email": null,
      "ip": "2a00:23c7:9c8f:1e01:5d1:2b0f:a9e4:7731"
    },
    "context": {
      "browser": "Edge 141",
      "os": "Windows 11",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"
    },
    "tags": {
      "release": "2026.10.12-1",
      "environment": "production",
      "locale": "de-DE"
    }
  },
  {
    "id": "e-noisy-1",
    "issueId": "i-noisy",
    "receivedAt": "2026-10-13T09:11:20Z",
    "release": "2026.10.12-1",
    "environment": "production",
    "level": "warning",
    "exception": {
      "type": "Error",
      "message": "ResizeObserver loop completed with undelivered notifications.",
      "frames": []
    },
    "breadcrumbs": [
      {
        "at": "2026-10-13T09:10:00Z",
        "category": "navigation",
        "level": "info",
        "message": "/ → /shop/mugs"
      }
    ],
    "request": {
      "method": "GET",
      "url": "https://kilnandclay.co.uk/shop/mugs",
      "status": null
    },
    "user": {
      "id": null,
      "email": null,
      "ip": "86.4.112.90"
    },
    "context": {
      "browser": "Chrome 141",
      "os": "macOS 15.6",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
    },
    "tags": {
      "environment": "production"
    }
  },
  {
    "id": "e-harbour-1",
    "issueId": "i-harbour-fetch",
    "receivedAt": "2026-10-13T09:11:35Z",
    "release": "v2.14.0",
    "environment": "production",
    "level": "fatal",
    "exception": {
      "type": "FetchError",
      "message": "request to https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 failed, reason: connect ETIMEDOUT 10.4.2.17:443",
      "frames": [
        {
          "file": "app/book/[practice]/slots/route.ts",
          "function": "GET",
          "line": 37,
          "column": 21,
          "inApp": true,
          "mapped": true,
          "context": {
            "startLine": 33,
            "highlight": 37,
            "lines": [
              "export async function GET(req: Request, { params }: Ctx) {",
              "  const from = new URL(req.url).searchParams.get(\"from\") ?? today()",
              "  const practice = await getPractice(params.practice)",
              "",
              "  const res = await fetch(`${SYNC_BASE}/slots?practice=${practice.slug}&from=${from}`, {",
              "    signal: AbortSignal.timeout(8000),",
              "  })",
              "  if (!res.ok) throw new SlotsUnavailable(res.status)"
            ]
          }
        },
        {
          "file": "lib/practice/getPractice.ts",
          "function": "getPractice",
          "line": 12,
          "column": 3,
          "inApp": true,
          "mapped": true,
          "context": null
        },
        {
          "file": "node:internal/deps/undici/undici",
          "function": "fetch",
          "line": 13502,
          "column": 13,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node:internal/process/task_queues",
          "function": "processTicksAndRejections",
          "line": 105,
          "column": 5,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/next/dist/server/route-modules/app-route/module.js",
          "function": "AppRouteRouteModule.do",
          "line": 1,
          "column": 38782,
          "inApp": false,
          "mapped": false,
          "context": null
        },
        {
          "file": "node_modules/next/dist/server/route-modules/app-route/module.js",
          "function": "AppRouteRouteModule.handle",
          "line": 1,
          "column": 45111,
          "inApp": false,
          "mapped": false,
          "context": null
        }
      ]
    },
    "breadcrumbs": [
      {
        "at": "2026-10-13T09:11:20Z",
        "category": "log",
        "level": "info",
        "message": "slots: cache miss practice=whitby from=2026-10-13"
      },
      {
        "at": "2026-10-13T09:11:27Z",
        "category": "fetch",
        "level": "info",
        "message": "GET https://practice-sync.internal/slots?practice=whitby&from=2026-10-13 (pending)"
      },
      {
        "at": "2026-10-13T09:11:35Z",
        "category": "log",
        "level": "error",
        "message": "slots: upstream timed out after 8000ms"
      }
    ],
    "request": {
      "method": "GET",
      "url": "https://book.harbourdental.co.uk/book/whitby/slots?from=2026-10-13",
      "status": 502
    },
    "user": null,
    "context": {
      "browser": null,
      "os": "Linux",
      "runtime": "node 22.11.0",
      "userAgent": null
    },
    "tags": {
      "release": "v2.14.0",
      "environment": "production",
      "region": "lhr1",
      "practice": "whitby"
    }
  },
  {
    "id": "e-moss-1",
    "issueId": "i-moss-regressed",
    "receivedAt": "2026-10-13T08:22:00Z",
    "release": "v3.8.1",
    "environment": "production",
    "level": "error",
    "exception": {
      "type": "TypeError",
      "message": "Failed to fetch",
      "frames": [
        {
          "file": "components/EnquiryForm.tsx",
          "function": "submitEnquiry",
          "line": 203,
          "column": 23,
          "inApp": true,
          "mapped": true,
          "context": {
            "startLine": 199,
            "highlight": 203,
            "lines": [
              "  async function submitEnquiry(values: EnquiryValues) {",
              "    setSending(true)",
              "    try {",
              "      // v3.8.1: posts directly to the CRM form endpoint",
              "      const res = await fetch(CRM_FORM_ENDPOINT, { method: \"POST\", body: toFormData(values) })",
              "      if (!res.ok) throw new EnquiryRejected(res.status)",
              "      router.push(\"/enquire/thank-you\")",
              "    } finally {",
              "      setSending(false)"
            ]
          }
        },
        {
          "file": "components/EnquiryForm.tsx",
          "function": "onSubmit",
          "line": 151,
          "column": 5,
          "inApp": true,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderWithHooks",
          "line": 11672,
          "column": 42,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "updateFunctionComponent",
          "line": 11244,
          "column": 68,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "beginWork",
          "line": 11351,
          "column": 72,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performUnitOfWork",
          "line": 5339,
          "column": 50,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "workLoopSync",
          "line": 6799,
          "column": 18,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "renderRootSync",
          "line": 12781,
          "column": 51,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "recoverFromConcurrentError",
          "line": 11431,
          "column": 2,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "performSyncWorkOnRoot",
          "line": 5727,
          "column": 57,
          "inApp": false,
          "mapped": true,
          "context": null
        },
        {
          "file": "node_modules/react-dom/cjs/react-dom-client.production.js",
          "function": "flushSyncCallbacks",
          "line": 8979,
          "column": 24,
          "inApp": false,
          "mapped": true,
          "context": null
        }
      ]
    },
    "breadcrumbs": [
      {
        "at": "2026-10-13T08:14:00Z",
        "category": "navigation",
        "level": "info",
        "message": "/ → /enquire?date=2027-06-19&type=ceremony-and-reception"
      },
      {
        "at": "2026-10-13T08:20:00Z",
        "category": "click",
        "level": "info",
        "message": "input#guests"
      },
      {
        "at": "2026-10-13T08:21:00Z",
        "category": "click",
        "level": "info",
        "message": "button[type=submit] \"Send enquiry\""
      },
      {
        "at": "2026-10-13T08:21:59.100Z",
        "category": "fetch",
        "level": "error",
        "message": "POST https://forms.hallcrm.example/f/7731 — failed (CORS)"
      }
    ],
    "request": {
      "method": "GET",
      "url": "https://enquiries.mossgrovehall.co.uk/enquire?date=2027-06-19&type=ceremony-and-reception",
      "status": null
    },
    "user": {
      "id": null,
      "email": "amelia.hart.wedding@gmail.com",
      "ip": null
    },
    "context": {
      "browser": "Safari 26.0",
      "os": "macOS 15.6",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15"
    },
    "tags": {
      "release": "v3.8.1",
      "environment": "production",
      "form": "wedding-enquiry-v2"
    }
  },
  {
    "id": "e-longest-1",
    "issueId": "i-longest",
    "receivedAt": "2026-10-13T04:12:00Z",
    "release": "v3.8.1",
    "environment": "production",
    "level": "error",
    "exception": {
      "type": "ValidationError",
      "message": "enquiry.guestCount must be a whole number between 1 and 250 but received \"around 120 maybe 140 depending on whether the evening guests are included, will confirm with my partner and her mum this weekend\" (field: guests, form: wedding-enquiry-v2, step 3 of 4, locale: en-GB)",
      "frames": [
        {
          "file": "lib/forms/wedding-enquiry/validateStepThree.ts",
          "function": "parseGuestCount",
          "line": 64,
          "column": 11,
          "inApp": true,
          "mapped": true,
          "context": null
        },
        {
          "file": "lib/forms/wedding-enquiry/validateStepThree.ts",
          "function": "validateStepThree",
          "line": 21,
          "column": 18,
          "inApp": true,
          "mapped": true,
          "context": null
        }
      ]
    },
    "breadcrumbs": [],
    "request": {
      "method": "POST",
      "url": "https://enquiries.mossgrovehall.co.uk/enquire/step/3",
      "status": 422
    },
    "user": null,
    "context": {
      "browser": "Chrome Mobile 141",
      "os": "Android 15",
      "runtime": null,
      "userAgent": "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
    },
    "tags": {
      "environment": "production",
      "step": "3"
    }
  },
  {
    "id": "e-nostack-1",
    "issueId": "i-no-stack",
    "receivedAt": "2026-10-07T09:12:00Z",
    "release": "1.4.0",
    "environment": "production",
    "level": "warning",
    "exception": null,
    "breadcrumbs": [],
    "request": null,
    "user": {
      "id": "editor",
      "email": null,
      "ip": null
    },
    "context": {
      "browser": "Firefox 143",
      "os": "Windows 11",
      "runtime": null,
      "userAgent": null
    },
    "tags": {
      "environment": "production"
    }
  }
]
