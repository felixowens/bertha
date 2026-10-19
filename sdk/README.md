# @bigbertha/sdk

Error reporting for bertha. Browser, React, Node, edge and Next.js, with no dependencies
and source maps matched by debug id rather than by file path.

- About 5.8 kB gzipped in the browser (`npm run size` enforces the budget).
- Batches events, backs off when bertha says so, and sends what's queued as the page or
  process goes away.
- Scrubs emails, bearer tokens and secret-looking query values by default.
- Each event says how it surfaced (an uncaught error, a rejection, a boundary, a call),
  where (the page or request) and in what state, and links the page's requests to the
  server errors they caused by W3C `traceparent`.
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

`withBertha` options: `release`, `keepMaps`, `disableUpload`, `recordDeploy`. It removes the maps under
`.next/static` (the ones browsers can fetch) and keeps the server's, which aren't served
and which Vercel's build output can need. `keepMaps` takes `true`, `false` or a function
of the path inside `.next`. It also stamps the environment, so a Vercel preview reports
as staging. On Vercel it records the deploy after the upload, with Vercel's commit sha,
message and author, so the release page knows what went out (`recordDeploy: false`
turns that off).

For your own options (`beforeSend`, `tags`, `sampleRate`), call `init` from
`@bigbertha/sdk/browser` in `instrumentation-client.ts` instead of importing
`next/client`, and `init` from `@bigbertha/sdk/node` in `register()`. The build plugin
works the same either way, and it keeps the debug ids another tool (such as Sentry's
plugin) already gave the bundles, so both can run side by side. Wrap it inside
`withSentryConfig` and set Sentry's `sourcemaps.deleteSourcemapsAfterUpload: false`:
Sentry's plugin runs first, and the maps it deletes never reach bertha. bertha removes
the served ones afterwards.

## Vite (browser)

```ts
// src/main.ts
import { init } from "@bigbertha/sdk/browser"
init({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })

// vite.config.ts
import { bertha } from "@bigbertha/sdk/vite"
export default defineConfig({ plugins: [bertha()] })
```

### What a browser event carries

- **The page:** its URL as the event's request, scrubbed like any URL.
- **How it surfaced:** `onerror` or `onunhandledrejection`, neither caught by the app.
- **Page state:** viewport and pixel ratio, online, tab visible, how the page was opened
  (navigate, reload, back/forward, prerender), how long it had been open, whether the
  browser is automated (`navigator.webdriver`), the referrer, language, timezone and
  connection type, and the Next.js version when there is one.
- **The visitor's IP**, which bertha reads from the request and stores in full.
  `sendIp: false` turns it off; an IP given to `setUser` is used instead.
- **Breadcrumbs:** the page load with its navigation type, restores from the
  back-forward cache, the tab hiding and showing, route changes, clicks, fetch and XHR
  with status and duration, and `console.log`, `info`, `warn` and `error`. Turn any off
  with `breadcrumbs: { console: false }` and so on.
- **A trace id**, one per page load. Same-origin fetch and XHR requests carry a
  `traceparent` header with it, so a server error a request caused lists the page's
  error beside it. For an API on another origin, list it in `tracePropagationTargets`
  (URL prefixes or patterns) and allow the `traceparent` header in its CORS:

  ```ts
  init({ key, url, tracePropagationTargets: ["https://api.example.com"] })
  ```

Frames in browser extensions and in scripts Safari hides (`webkit-masked-url://`) are
sent as not the app's code, so bertha can say when an error probably isn't yours.

The plugin turns on hidden source maps if the build has none. It only uploads when
`BERTHA_UPLOAD_KEY` is set, so local builds stay offline and keep their maps.
Options: `release`, `url`, `uploadKey`, `keepMaps`.

## React

```tsx
import { ErrorBoundary } from "@bigbertha/sdk/react"

<ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Try again</button>}>
  <App />
</ErrorBoundary>
```

`ErrorBoundary` reports what it catches with React's component stack, then renders
`fallback`: a node, or a function of `{ error, eventId, reset }`. It also takes
`onError(error, componentStack, eventId)` and `tags`. Importing the entry adds React's
version to every event. React is an optional peer dependency; nothing else in the SDK
needs it.

## Node

```ts
import { init } from "@bigbertha/sdk/node"
init() // reads BERTHA_KEY, BERTHA_URL, BERTHA_RELEASE, BERTHA_COMMIT and NODE_ENV
```

`init` reports uncaught exceptions and unhandled rejections, flushes, then exits as Node
would (`handlers: false` turns that off). It also sends a heartbeat every 20 minutes so
bertha can tell "no errors" from "not running" (`heartbeat: false`). The heartbeat names
the commit the process runs, from `commit`, `BERTHA_COMMIT` or the host's own variable
(Heroku's `HEROKU_SLUG_COMMIT` with dyno metadata on, Render, Railway, Vercel, GitHub
Actions), so a release that no `bertha deploy` recorded still points at its code.

Code that Node runs as-is needs no source maps: the SDK reads the lines around each
frame in your own files from disk and sends them with the event (`contextLines: false`
turns that off). It also raises V8's default stack limit from 10 frames to 50, so a
deep framework call doesn't hide your code. A limit you set yourself is left alone.

`wrapHandler(fn)` reports what a request handler throws and rethrows it, with the
request: its URL, its headers (never `authorization`, `proxy-authorization`, `cookie`,
`set-cookie` or `x-api-key`), the client IP from the first `x-forwarded-for` hop or the
socket, and the trace from an incoming `traceparent`. Next.js's `onRequestError` sends
the same. Server events also name the host (Heroku's `DYNO`, else the hostname) and the
Node and Next.js versions.

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
// An error's own fields (code, status…) are sent with it, each as JSON.
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
| `scrub` | `true` | Redact emails, bearer tokens and secret query values, and drop the error's own fields with credential names (`password`, `token`, `apiKey`…). |
| `tags` | | Tags on every event. |
| `versions` | | More versions on every event, as `{ name: version }`. |
| `sendIp` | `true` | Browser: store the visitor's IP. |
| `tracePropagationTargets` | same origin only | Browser: other origins whose requests get a `traceparent`. |
| `breadcrumbs` | all on | Browser: `fetch`, `xhr`, `navigation`, `click`, `console`. |
| `debug` | `false` | Log what the SDK does. |

## Deploys

Record each deploy from CI, after it goes out:

```bash
npx bertha deploy --env production
```

It sends the release and the last commit's sha, message and author. The release page
then shows what the deploy brought in and what went quiet after it. A first event from an
unknown release also creates the release, and bertha marks it as only seen, not deployed.
When the release is a full commit sha, bertha takes it as the commit.

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
