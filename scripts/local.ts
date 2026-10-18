// bertha on this machine, to play with: the real binary on a database in .local/, with
// an SMTP sink that prints every email's links here, and a site you can switch off.
//
//   npm run local                      your own empty bertha (kept between runs)
//   npm run local -- --demo            the design fixtures, clock stopped on 13 Oct
//   npm run local -- --fresh           start the database over
//   npm run local -- --no-build        skip rebuilding the app and binary
//   npm run local -- --email a@b.c     the owner's address (default: git user.email)
//   npm run local -- throw [project]   send sample errors to a project (another terminal)

import { execFileSync, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { binary, flakySite, smtpSink, type Mail } from "../e2e/harness.ts"

const ROOT = resolve(import.meta.dirname, "..")
const DIR = join(ROOT, ".local")
const PORT = 3000
const URL = `http://localhost:${PORT}`
const SITE_PORT = 4400
/** The moment the fixtures describe (src/data/fixtures.ts NOW). */
const DEMO_NOW = "2026-10-13T09:12:00Z"
const DEMO_OWNER = "hello@sundial.dev"

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const demo = flag("demo")
const db = join(DIR, demo ? "demo.db" : "bertha.db")

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    BERTHA_URL: URL,
    BERTHA_BIND: `127.0.0.1:${PORT}`,
    DATABASE_PATH: db,
    BERTHA_REGION: "local",
    RUST_LOG: "info,tower_http=warn,sqlx=warn",
    ...extra,
  }
}

const cli = (...a: string[]) => execFileSync(binary(), a, { env: env(), encoding: "utf8" }).trim()

const dim = (s: string) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s)
const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)

if (args[0] === "throw") await throwErrors(args[1])
else await serve()

async function serve() {
  if (!flag("no-build")) {
    console.log(dim("Building the app and the binary…"))
    // Without RUSTUP_TOOLCHAIN, server/rust-toolchain.toml picks the toolchain.
    const { RUSTUP_TOOLCHAIN: _, ...cargoEnv } = process.env
    try {
      execFileSync("npm", ["run", "build", "--silent"], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] })
      execFileSync("cargo", ["build", "-q", "--release", "--features", "fixtures"], { cwd: join(ROOT, "server"), stdio: "inherit", env: cargoEnv })
    } catch {
      console.error("The build failed (above). Fix it, or run with --no-build to use the last binary.")
      process.exit(1)
    }
  }

  const inUse = await fetch(`${URL}/healthz`).then(() => true, () => false)
  if (inUse) {
    console.error(`Something already answers on port ${PORT}. Stop it, then run this again.`)
    process.exit(1)
  }

  mkdirSync(DIR, { recursive: true })
  if (flag("fresh")) for (const f of [db, `${db}-wal`, `${db}-shm`]) rmSync(f, { force: true })
  const isNew = !existsSync(db)

  const owner = demo ? DEMO_OWNER : (option("email") ?? gitEmail())
  if (isNew) {
    if (demo) cli("seed", "--builtin", "--dev-invites")
    else cli("owner", "create", owner)
  }

  const sink = await smtpSink(printMail)
  const site = await flakySite(SITE_PORT).catch(() => flakySite())

  const log = createWriteStream(join(DIR, "bertha.log"), { flags: "a" })
  const child = spawn(binary(), ["serve"], {
    env: env({
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(sink.smtpPort),
      SMTP_SECURITY: "none",
      SMTP_FROM: "bertha <bertha@localhost>",
      // Uptime checks every 10s instead of each monitor's interval, so downtime shows
      // up quickly. The demo stops the clock (and with it the workers) instead.
      ...(demo ? { BERTHA_FIXED_NOW: DEMO_NOW } : { BERTHA_CHECK_EVERY_SECONDS: "10" }),
    }),
    stdio: ["ignore", "pipe", "pipe"],
  })
  for (const s of [child.stdout, child.stderr]) {
    s.pipe(log, { end: false })
    // Surface problems; the rest stays in the log file.
    s.on("data", (d: Buffer) => {
      for (const line of d.toString().split("\n"))
        if (/\b(WARN|ERROR)\b|panicked/.test(line)) console.log(dim(`bertha: ${line.replace(/\x1b\[[0-9;]*m/g, "")}`))
    })
  }
  const stop = () => {
    child.kill("SIGTERM")
    sink.close()
    site.close()
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
  child.on("exit", (code) => {
    if (code) console.error(`bertha stopped (exit ${code}). The log is in .local/bertha.log.`)
    sink.close()
    site.close()
    process.exit(code ?? 0)
  })

  const end = Date.now() + 15_000
  while (!(await fetch(`${URL}/healthz`).then((r) => r.ok, () => false))) {
    if (child.exitCode !== null) return
    if (Date.now() > end) {
      console.error("bertha didn't answer within 15s. The log is in .local/bertha.log.")
      return stop()
    }
    await sleep(100)
  }

  console.log(`
${bold(`bertha is running at ${URL}`)}${demo ? dim("  (demo: clock stopped on 13 Oct 2026, nothing new arrives)") : ""}

  database     ${db.replace(ROOT + "/", "")}${isNew ? " (new)" : ""}. ${dim("--fresh starts over")}
  owner        ${owner}
  test site    http://127.0.0.1:${site.port}/health ${dim(`curl -X POST 127.0.0.1:${site.port}/down (or /up)`)}
  errors       ${dim("in another terminal:")} npm run local -- throw "<project name>"
  emails       print here: sign-in links, invites, alerts
  log          .local/bertha.log
${demo ? `  invites      ${URL}/invite/valid, /invite/expired, /invite/used\n` : ""}
Ctrl-C stops everything.
`)

  // Ask for a sign-in link straight away; it prints below as soon as it's sent.
  const r = await fetch(`${URL}/api/v1/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bertha": "1" },
    body: JSON.stringify({ email: owner }),
  })
  if (!r.ok) console.log(`Couldn't ask for a sign-in link (${r.status}). Use the sign-in page.`)
}

function gitEmail(): string {
  try {
    const e = execFileSync("git", ["config", "user.email"], { encoding: "utf8" }).trim()
    if (e) return e
  } catch {
    /* fall through */
  }
  console.error("No owner address. Pass one: npm run local -- --email you@example.com")
  process.exit(1)
}

function printMail(m: Mail) {
  const links = m.body.match(/https?:\/\/\S+/g) ?? []
  console.log(`${dim("mail")} ${m.subject} ${dim(`to ${m.to.join(", ")}`)}`)
  for (const l of links) console.log(`     ${l}`)
}

// ── throw ────────────────────────────────────────────────────────────────

async function throwErrors(project: string | undefined) {
  if (!existsSync(db)) {
    console.error("There's no local bertha yet. Run npm run local first.")
    process.exit(1)
  }
  const list = cli("project", "list")
    .split("\n")
    .filter((l) => l.includes("\t"))
    .map((l) => l.split("\t"))
  if (!list.length) {
    console.error(`No projects yet. Create one at ${URL}/projects/new, then run this again.`)
    process.exit(1)
  }
  if (!project) {
    if (list.length > 1) {
      console.error("Which project? Pass its name or key:")
      for (const [, key, name] of list) console.error(`  ${key}\t${name}`)
      process.exit(1)
    }
    project = list[0][2]
  }
  const keys = Object.fromEntries(
    cli("project", "keys", project)
      .split("\n")
      .map((l) => l.split("=") as [string, string]),
  )

  const now = Date.now()
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString()
  const frames = (...fns: [string, string, number][]) => fns.map(([file, fn, line]) => ({ file, function: fn, line, column: 12 }))
  const crumbs = [
    { timestamp: at(2), category: "navigation", message: "/ → /checkout" },
    { timestamp: at(1), category: "fetch", message: "POST /api/basket 200" },
    { timestamp: at(1), category: "ui.click", message: "button#pay" },
  ]
  const samples = [
    {
      times: 14,
      event: {
        level: "error",
        release: "1.4.2",
        exception: {
          type: "TypeError",
          message: "Cannot read properties of undefined (reading 'price')",
          frames: frames(["src/lib/checkout.ts", "lineTotal", 18], ["src/lib/checkout.ts", "total", 9], ["src/routes/checkout/+page.ts", "load", 31]),
        },
        request: { method: "GET", url: "https://shop.example.com/checkout", status: 500 },
        context: { browser: "Safari 18.2", os: "iOS 18.2" },
        breadcrumbs: crumbs,
      },
    },
    {
      times: 3,
      event: {
        level: "fatal",
        release: "1.4.2",
        exception: {
          type: "Error",
          message: "connect ECONNREFUSED 10.0.0.12:5432",
          frames: frames(["src/server/db.ts", "connect", 44], ["src/server/orders.ts", "listOrders", 12]),
          cause: { type: "AggregateError", message: "All connection attempts failed", frames: [] },
        },
        request: { method: "GET", url: "https://shop.example.com/api/orders", status: 502 },
        context: { runtime: "node 24.12.0" },
      },
    },
    {
      times: 40,
      event: {
        level: "warning",
        release: "1.4.1",
        message: "Slow response from payment provider (4.2s)",
      },
    },
    {
      times: 1,
      event: {
        level: "error",
        release: "1.4.2",
        exception: {
          type: "RangeError",
          message: "Invalid time value",
          frames: frames(["src/lib/format.ts", "formatDate", 7], ["src/components/OrderRow.tsx", "OrderRow", 22]),
        },
        context: { browser: "Firefox 133", os: "Windows 11" },
      },
    },
  ]
  type Sample = { times: number; event: { request?: { url: string } } & Record<string, unknown> }
  const events = (samples as Sample[]).flatMap(({ times, event }) =>
    Array.from({ length: times }, (_, i) => ({
      ...event,
      id: randomUUID(),
      timestamp: at(Math.floor((i / times) * 50)),
      environment: "production",
      user: { id: `u_${(i * 7) % 23}` },
      tags: { route: event.request ? new globalThis.URL(event.request.url).pathname : "/" },
    })),
  )
  const res = await fetch(`${URL}/ingest/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.BERTHA_KEY}` },
    body: JSON.stringify({ sdk: { name: "bertha-local", version: "0" }, events }),
  })
  const body = (await res.json().catch(() => ({}))) as { accepted?: number; error?: string }
  if (!res.ok) {
    console.error(`bertha refused them (${res.status}): ${body.error ?? "no reason given"}`)
    process.exit(1)
  }
  console.log(`Sent ${body.accepted ?? events.length} events across ${samples.length} errors to ${project}. ${URL}/issues`)
}
