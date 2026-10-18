# @bigbertha/sdk

Error reporting for bertha. Browser, Node, edge and Next.js, with no dependencies and
source maps matched by debug id rather than by file path.

- About 4.4 kB gzipped in the browser (`npm run size` enforces the budget).
- Batches events, backs off when bertha says so, and sends what's queued as the page or
  process goes away.
- Scrubs emails, bearer tokens and secret-looking query values by default.
- The build plugins give each bundle a debug id, upload its map and delete the `.map`
  files, so maps never ship to browsers.

Each project's setup page in bertha shows the exact snippet for its runtimes, with its
keys filled in. This file covers the same ground in more detail.

## Install

```bash
npm install @bigbertha/sdk
```

Each version is also attached to its GitHub release as `bigbertha-sdk-<version>.tgz`.
To build one yourself: `npm ci && npm run build && npm pack` in this folder.

## Keys

Every project has two:

- **Ingest key** (`BERTHA_KEY`): sends events. It ships to browsers, so it's public; a
  leaked key can only send events, at most 50 a second.
- **Upload key** (`BERTHA_UPLOAD_KEY`): uploads source maps and records deploys. Keep it
  in CI secrets only.

`bertha project keys <name>` on the server prints both. Rotating the ingest key in
project settings stops the old one at once.

## Next.js

```bash
# .env.local and your host
NEXT_PUBLIC_BERTHA_KEY="…"
NEXT_PUBLIC_BERTHA_URL="https://bertha.example.com"
BERTHA_UPLOAD_KEY="…"   # CI only
```

```ts
// instrumentation.ts: server and edge errors, including onRequestError
export { register, onRequestError } from "@bigbertha/sdk/next"

// instrumentation-client.ts: browser errors and navigation breadcrumbs
export { onRouterTransitionStart } from "@bigbertha/sdk/next/client"

// next.config.ts: stamps the release, uploads maps after `next build`
import { withBertha } from "@bigbertha/sdk/next/config"
export default withBertha({ /* your config */ })
```

`withBertha` options: `release`, `keepMaps` (default false), `disableUpload`. It also
stamps the environment, so a Vercel preview reports as staging.

For your own options (`beforeSend`, `tags`, `sampleRate`), call `init` from
`@bigbertha/sdk/browser` in `instrumentation-client.ts` instead of importing
`next/client`, and `init` from `@bigbertha/sdk/node` in `register()`. The build plugin
works the same either way, and it keeps the debug ids another tool (such as Sentry's
plugin) already gave the bundles, so both can run side by side.

## Vite (browser)

```ts
// src/main.ts
import { init } from "@bigbertha/sdk/browser"
init({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })

// vite.config.ts
import { bertha } from "@bigbertha/sdk/vite"
export default defineConfig({ plugins: [bertha()] })
```

The plugin turns on hidden source maps if the build has none. It only uploads when
`BERTHA_UPLOAD_KEY` is set, so local builds stay offline and keep their maps.
Options: `release`, `url`, `uploadKey`, `keepMaps`.

## Node

```ts
import { init } from "@bigbertha/sdk/node"
init() // reads BERTHA_KEY, BERTHA_URL, BERTHA_RELEASE and NODE_ENV
```

`init` reports uncaught exceptions and unhandled rejections, flushes, then exits as Node
would (`handlers: false` turns that off). It also sends a heartbeat every 20 minutes so
bertha can tell "no errors" from "not running" (`heartbeat: false`).

`wrapHandler(fn)` reports what a request handler throws and rethrows it.

For bundled Node code, give the output debug ids and upload its maps after the build:

```bash
npx bertha sourcemaps upload dist
```

## Edge

```ts
import { init } from "@bigbertha/sdk/edge"
init({ key: env.BERTHA_KEY, url: env.BERTHA_URL })
```

## Capturing by hand

Every entry exports the same functions:

```ts
captureException(err, { level: "warning", tags: { job: "nightly" }, fingerprint: ["nightly-import"] })
captureMessage("Payment provider slow", { level: "warning" })
addBreadcrumb({ category: "cart", message: "Added 2 items" })
setUser({ id: "u_42" })   // hashed on the server, never shown in full
setTag("tenant", "harbour")
await flush()
```

## Options

| Option | Default | |
| --- | --- | --- |
| `key`, `url` | from env (Node, edge) | Required in the browser. |
| `release` | stamped at build time | The plugins stamp it from `BERTHA_RELEASE`, the CI's commit sha or `git HEAD`. |
| `environment` | `BERTHA_ENVIRONMENT`, `VERCEL_ENV` or `NODE_ENV` (Node, edge; `withBertha` stamps it for the browser), else production | Free text is mapped to production, staging or development. |
| `sampleRate` | `1` | Share of events to send. |
| `beforeSend` | | Change an event, or return `null` to drop it. |
| `scrub` | `true` | Redact emails, bearer tokens and secret query values. |
| `tags` | | Tags on every event. |
| `debug` | `false` | Log what the SDK does. |

## Deploys

Record each deploy from CI, after it goes out:

```bash
npx bertha deploy --env production
```

It sends the release and the last commit's sha, message and author. The release page
then shows what the deploy brought in and what went quiet after it. A first event from an
unknown release also creates the release, without the commit details.

## Development

```bash
npm run check   # types
npm test        # unit tests
npm run size    # browser bundle budget
npm run e2e     # the real bertha binary and the example apps, end to end
```

`npm run e2e` uses `../server/target/debug/bertha`, or `BERTHA_BIN`. `-- --next` adds the
Next.js example (`npm install` in `examples/next-app` first).

## License

MIT. See [LICENSE](LICENSE).
