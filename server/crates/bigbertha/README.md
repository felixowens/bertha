# bigbertha

Error reporting for [bertha](https://github.com/felixowens/bertha) from Rust: panics,
errors with their causes and backtraces, `tracing` events and axum or any tower service.

- Sends from its own thread with a blocking client, so it works without tokio, outside
  any runtime and from a panic hook.
- Batches events, backs off when bertha says so, and sends what's queued when the guard
  drops.
- Scrubs emails, bearer tokens and secret-looking query values by default.
- Each event says how it surfaced (a panic, a `tracing` error, a call), the request it
  happened in, and joins the request's trace by W3C `traceparent` or OpenTelemetry.

Each project's setup page in bertha shows the exact snippet for a Rust server, with its
keys filled in. This file covers the same ground in more detail.

## Install

```bash
cargo add bigbertha --features tracing,tower,anyhow
```

| Feature | What it adds |
| --- | --- |
| `client` (default) | Capturing, batching and sending. |
| `panic` (default) | Reports panics, with the backtrace from where they happened. |
| `tracing` | A layer: ERROR events become reports, WARN and INFO breadcrumbs. |
| `tower` | A layer for axum, tonic or any `http` service: the request on every report, and panics as 500s. |
| `anyhow` | `capture_anyhow`, with anyhow's backtrace and context chain. |
| `opentelemetry` | Reports join the active span's trace. |

Rust 1.85 or later.

## Keys

```bash
BERTHA_KEY="..."           # the project's ingest key
BERTHA_URL="https://bertha.example.com"
BERTHA_ENVIRONMENT="production"   # optional
BERTHA_RELEASE="..."              # optional, see Releases
BERTHA_UPLOAD_KEY="..."    # secret: CI only, for deploys
```

Without a key or URL, `init` warns once and returns `None`. Nothing is sent, and every
capture is a no-op.

## Setup

First thing in `main`. Keep the guard until `main` returns: dropping it sends what's
left, waiting up to 2s.

```rust
use tracing_subscriber::{fmt, prelude::*};

#[tokio::main]
async fn main() {
    let _bertha = bigbertha::init(bigbertha::options!());
    tracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();

    let app = axum::Router::new()
        .route("/orders/{id}", axum::routing::get(order))
        .layer(bigbertha::tower::layer());
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

`options!()` reads the environment and records your crate's name, version and directory,
so frames in your code are marked as yours and their paths read as `src/orders.rs`.

### Line numbers in release builds

A release build has no line tables by default, so frames arrive without files or lines.
Keep the tables (they add little to the binary and nothing at runtime):

```toml
[profile.release]
debug = "line-tables-only"
```

## Panics

With the default `panic` feature, `init` chains a panic hook. A panic is reported as
`fatal` with the backtrace from where it happened, sent within 2s, and then the previous
hook runs as before. `.panics(false)` turns it off.

Under the tower layer, a panic in a handler is reported with its request and answered
with a 500, so the server keeps serving.

## tracing

`bigbertha::tracing::layer()` reports every ERROR event, and keeps WARN and INFO events as
breadcrumbs, with the target as the category.

```rust
tracing::error!(error = &e as &dyn std::error::Error, order = id, "Couldn't charge the card");
```

- The message is the event's message.
- An `error`, `err`, `e` or `cause` field recorded as an error gives the type and its
  `source()` chain.
- An anyhow error logged with `?` (`error = ?e`) gives its context chain and backtrace.
- Other fields become tags, cut to 500 characters.

An error already captured by hand is not reported again by the event that logs it.

## Requests (tower and axum)

`bigbertha::tower::layer()` gives each request a scope. Every report made while handling
it carries:

- the method, the URL (from `x-forwarded-proto` and `host`) and the headers, without
  credentials;
- the client's IP, from the first `x-forwarded-for`;
- the trace from `traceparent`, and `x-request-id` as a tag;
- the response status, once it's known.

If your app is called from a browser on another origin, allow `traceparent` in CORS so
the page's trace reaches the server.

Outside tower, make a scope yourself:

```rust
let scope = bigbertha::Scope::new();
scope.set_user(bigbertha::IngestUser { id: Some(user_id), ..Default::default() });
scope.bind(handle(job)).await;   // or scope.run(|| ...) for sync code
```

## anyhow

`capture_anyhow(&e)` sends the error's context chain and the backtrace anyhow captured
where the error was made. anyhow captures one only when asked:

```bash
RUST_LIB_BACKTRACE=1
```

Without it, anyhow errors arrive without a stack and group by type and message. With
`.debug(true)`, `init` says so.

```rust
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            ApiError::Internal(e) => {
                bigbertha::capture_anyhow(&e);
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            // ...
        }
    }
}
```

## Capturing by hand

```rust
use bigbertha::{Capture, Level};

bigbertha::capture_error(&e);                                  // any std::error::Error
bigbertha::capture_dyn_error(&*boxed, Capture::new());         // a Box<dyn Error>
bigbertha::capture_message("Stock went negative", Capture::new().level(Level::Error));

bigbertha::capture_error_with(&e, Capture::new()
    .tag("order", id.to_string())
    .fingerprint(["payment-declined"]));

bigbertha::add_breadcrumb("payment", "Charged card");
bigbertha::set_user(Some(bigbertha::IngestUser { id: Some("u_41".into()), ..Default::default() }));
bigbertha::set_tag("region", "eu");
bigbertha::flush(std::time::Duration::from_secs(2));
```

Plain errors carry no stack: Rust errors don't record where they were made, and the
capture site would group every error together. bertha groups them by type and message.
For a stack, use anyhow with `RUST_LIB_BACKTRACE=1`.

Each capture returns the event id, or `None` when it was dropped.

## Releases

Each event names the release it came from. The first of these wins:

1. `.release(...)` or `BERTHA_RELEASE` at runtime;
2. `BERTHA_RELEASE` when the app was built (read by `options!()`);
3. the commit, from `BERTHA_COMMIT` or the host's own variable (`GITHUB_SHA`,
   `RENDER_GIT_COMMIT`…);
4. the crate version.

This is the same order `npx @bigbertha/sdk deploy` uses, so events and deploys name the
same release. Setting `BERTHA_RELEASE` in the build is the surest way.

## Deploys

Record each deploy from CI, after it goes out:

```bash
npx @bigbertha/sdk deploy --env production
```

Or from Rust, with the upload key:

```rust
let deploy = bigbertha::wire::IngestDeploy {
    release: "3.1.0".into(),
    environment: Some("production".into()),
    commit: None,
    deployed_at: None,   // now
};
bigbertha::record_deploy(&url, &upload_key, &deploy)?;
```

## Traces

bertha takes OpenTelemetry traces over OTLP/HTTP, and shows them on an error's page.
`otlp()` gives the endpoint and the key's header from `BERTHA_KEY` and `BERTHA_URL`:

```rust
let o = bigbertha::otlp().expect("BERTHA_KEY and BERTHA_URL");
let exporter = opentelemetry_otlp::SpanExporter::builder()
    .with_http()
    .with_endpoint(o.endpoint)
    .with_headers(o.headers.into_iter().collect())
    .build()?;
```

With the `opentelemetry` feature, every event names the span that was active when it was
captured. A span on another trace than the request's `traceparent` is passed over.

## Options

Start from `options!()` and override with the setters:

| Setter | Default | |
| --- | --- | --- |
| `key`, `url` | `BERTHA_KEY`, `BERTHA_URL` | |
| `release` | see Releases | |
| `environment` | `BERTHA_ENVIRONMENT` | |
| `commit` | from the host's variables | Only a full sha counts. |
| `sample_rate` | `1.0` | The share of events sent. |
| `scrub` | `true` | Redact emails, bearer tokens and secret query values, and drop tags and request headers with credential names (`token`, `session`…). |
| `tag(k, v)` | | On every event. |
| `version(name, v)` | | Versions shown on every event, like a database's. |
| `heartbeat` | `true` | Tells bertha the app is up, every 20 minutes. |
| `panics` | `true` | Reports panics. |
| `debug` | `false` | Logs what the SDK does to stderr. |
| `before_send(f)` | | Change an event, or return `None` to drop it. |

```rust
bigbertha::options!().before_send(|mut event| {
    if let Some(headers) = event.request.as_mut().and_then(|r| r.headers.as_mut()) {
        headers.remove("x-client-phone");
    }
    Some(event)
})
```

If `before_send` panics, the event is sent as it was.

At most 100 events a minute are sent, and the last 100 breadcrumbs are kept.

## License

MIT
