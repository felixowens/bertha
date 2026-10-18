// End to end: the real bertha binary on a temporary database, the SDK built as
// published, and each example app throwing. Checks errors arrive grouped, with
// stacks mapped back to the original source through uploaded maps.
//
//   npm run e2e            node and vite examples
//   npm run e2e -- --next  also the Next.js example (npm install in examples/next-app first)

import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const SDK = resolve(import.meta.dirname, "..")
const SERVER = resolve(SDK, "../server")
const BIN = process.env.BERTHA_BIN ? resolve(process.env.BERTHA_BIN) : join(SERVER, "target/debug/bertha")
const RELEASE = "e2e-1"
const withNext = process.argv.includes("--next")

const children: ChildProcess[] = []
const work = realpathSync(mkdtempSync(join(tmpdir(), "bertha-e2e-")))
let failed = false

function step(name: string) {
  console.log(`\n· ${name}`)
}
function check(ok: unknown, what: string, detail?: unknown): asserts ok {
  if (ok) {
    console.log(`  ok  ${what}`)
    return
  }
  failed = true
  console.log(`  FAIL ${what}`)
  if (detail !== undefined) console.log(`       ${JSON.stringify(detail, null, 2)?.split("\n").join("\n       ")}`)
  throw new Error(what)
}

async function freePort(): Promise<number> {
  return new Promise((done) => {
    const s = createServer()
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port
      s.close(() => done(port))
    })
  })
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): string {
  return execFileSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function start(cmd: string, args: string[], opts: { cwd?: string; env: Record<string, string> }) {
  const child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, stdio: ["ignore", "pipe", "pipe"] })
  children.push(child)
  let output = ""
  child.stdout!.on("data", (d: Buffer) => (output += d))
  child.stderr!.on("data", (d: Buffer) => (output += d))
  return { child, output: () => output }
}

async function until<T>(what: string, f: () => Promise<T | undefined>, ms = 15_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = await f().catch(() => undefined)
    if (v !== undefined) return v
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await sleep(200)
  }
}

type Frame = { file: string; function: string | null; line: number | null; mapped: boolean; inApp: boolean; context: { lines: string[]; highlight: number; startLine: number } | null }
type Event = { exception: { type: string; message: string; frames: Frame[] } | null; release: string | null; context: { runtime: string | null } }

async function main() {
  step("Build bertha and the SDK")
  // With BERTHA_BIN (CI), that binary is already built; otherwise build a debug one.
  if (!process.env.BERTHA_BIN) {
    // rust-toolchain.toml picks the toolchain; a RUSTUP_TOOLCHAIN in the shell would override it.
    delete process.env.RUSTUP_TOOLCHAIN
    run("cargo", ["build", "-q", "-p", "bertha-server"], { cwd: SERVER })
  }
  run("npm", ["run", "build"], { cwd: SDK })
  check(existsSync(BIN), process.env.BERTHA_BIN ? `bertha binary at ${BIN}` : "bertha binary built")

  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const env = { BERTHA_URL: url, BERTHA_BIND: `127.0.0.1:${port}`, DATABASE_PATH: join(work, "bertha.db"), NO_COLOR: "1", RUST_LOG: "info" }

  step("Start bertha with an owner")
  run(BIN, ["owner", "create", "e2e@bertha.test"], { env })
  const server = start(BIN, ["serve"], { env })
  await until("bertha to listen", async () => ((await fetch(`${url}/healthz`)).ok ? true : undefined))
  check(true, `listening on ${url}`)

  step("Sign in by emailed link")
  const api = (path: string) => `${url}/api/v1${path}`
  const signIn = await fetch(api("/sign-in"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-bertha": "1" },
    body: JSON.stringify({ email: "e2e@bertha.test" }),
  }).then((r) => r.json() as Promise<{ ok: boolean }>)
  check(signIn.ok, "sign-in link sent", signIn)
  const token = await until("the sign-in email in the log", async () => /auth\/callback\?token=([\w-]+)/.exec(server.output())?.[1])
  const callback = await fetch(`${url}/auth/callback?token=${token}`, { redirect: "manual" })
  const cookie = callback.headers.get("set-cookie")?.split(";")[0]
  check(callback.status === 303 || callback.status === 302, "the link starts a session", callback.status)
  check(cookie, "session cookie set")
  const headers = { cookie, "content-type": "application/json", "x-bertha": "1" }
  const get = <T>(path: string) => fetch(api(path), { headers }).then((r) => r.json() as Promise<T>)
  const post = <T>(path: string, body: unknown) =>
    fetch(api(path), { method: "POST", headers, body: JSON.stringify(body) }).then((r) => r.json() as Promise<T>)

  step("Create a project and read its keys on the server")
  const created = await post<{ ok: boolean; value: { project: { id: string; key: string }; setup: { ingestKey: string } } }>("/projects", {
    name: "Lantern",
    client: null,
    url: null,
    runtimes: ["browser", "server"],
    environments: ["production"],
  })
  check(created.ok, "project created", created)
  const project = created.value.project
  const keys = Object.fromEntries(
    run(BIN, ["project", "keys", "lantern"], { env })
      .trim()
      .split("\n")
      .map((l) => l.split("=") as [string, string]),
  )
  check(keys.BERTHA_KEY === created.value.setup.ingestKey, "`bertha project keys` prints the ingest key")
  check(keys.BERTHA_UPLOAD_KEY?.length, "and the upload key")
  const sdkEnv = { BERTHA_URL: url, BERTHA_KEY: keys.BERTHA_KEY!, BERTHA_UPLOAD_KEY: keys.BERTHA_UPLOAD_KEY!, BERTHA_RELEASE: RELEASE }
  const cli = (...args: string[]) => run(process.execPath, [join(SDK, "dist/bin.js"), ...args], { env: sdkEnv })

  const issues = async () =>
    (
      await post<{ issues: { id: string; shortId: string; type: string; message: string; events: number }[] }>("/issues/query", {
        filter: { projectIds: [project.id], status: "all", levels: [], environment: "all", assignee: "anyone", query: "", sort: "last_seen", range: "24h" },
      })
    ).issues
  const latest = (id: string) => get<{ event: Event }>(`/issues/${id}/events/latest`).then((r) => r.event)
  const waitForIssue = (what: string, match: (i: { message: string; type: string }) => boolean) =>
    until(what, async () => (await issues()).find(match))

  step("Node: bundle, upload maps, deploy, crash")
  const nodeApp = join(work, "node-app")
  cpSync(join(SDK, "examples/node-app"), nodeApp, { recursive: true, filter: (p) => !p.includes("node_modules") })
  const { build } = await import("esbuild")
  await build({
    entryPoints: [join(nodeApp, "src/app.ts")],
    outfile: join(nodeApp, "dist/app.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    minify: true,
    sourcemap: true,
    alias: { "@bertha/sdk/node": join(SDK, "dist/node/index.js") },
    logLevel: "silent",
  })
  const uploaded = cli("sourcemaps", "upload", join(nodeApp, "dist"))
  check(uploaded.includes(`Uploaded 1 of 1 source maps for ${RELEASE}.`), "map uploaded", uploaded)
  check(!existsSync(join(nodeApp, "dist/app.mjs.map")), "map removed from the output")
  const deployed = cli("deploy", "--env", "production")
  check(deployed.startsWith(`Recorded ${RELEASE} in production`), "deploy recorded", deployed)

  let exit: number | null = null
  try {
    run(process.execPath, [join(nodeApp, "dist/app.mjs")], { env: { ...sdkEnv, NODE_ENV: "production" } })
  } catch (e) {
    exit = (e as { status: number }).status
  }
  check(exit === 1, "the app crashed with exit code 1", exit)
  const nodeIssue = await waitForIssue("the Node crash", (i) => i.type === "TypeError" && i.message.includes("price"))
  check(nodeIssue.shortId === `${project.key}-1`, `grouped as ${project.key}-1`, nodeIssue)
  const nodeEvent = await latest(nodeIssue.id)
  const top = nodeEvent.exception!.frames[0]!
  check(top.mapped && top.file === "src/checkout.ts", "top frame mapped to src/checkout.ts", top)
  check(top.context?.lines[top.context.highlight - top.context.startLine]?.includes("line!.price"), "with the source line that threw", top.context)
  check(nodeEvent.exception!.frames.some((f) => f.mapped && f.file === "src/app.ts" && (f.function === "settle" || f.function == null)), "caller in src/app.ts, never under a minified name", nodeEvent.exception!.frames.map((f) => [f.file, f.function, f.line, f.mapped]))
  check(nodeEvent.release === RELEASE, "release recorded on the event", nodeEvent.release)
  check(nodeEvent.context.runtime?.startsWith("Node "), "runtime recorded", nodeEvent.context)

  const releases = JSON.stringify(await get<unknown>(`/releases?project=${project.id}`))
  check(releases.includes(RELEASE) && /"sha":"[0-9a-f]{40}"/.test(releases), "release listed with its commit")
  const setup = await get<{ sourceMaps: { latestRelease: string | null; uploaded: boolean } }>(`/projects/${project.id}/setup`)
  check(setup.sourceMaps.uploaded && setup.sourceMaps.latestRelease === RELEASE, "setup shows maps for the latest release", setup.sourceMaps)

  step("Vite: build with the plugin")
  const { build: viteBuild } = await import("vite")
  const { bertha } = (await import(join(SDK, "dist/vite/index.js"))) as typeof import("../src/vite/index.ts")
  const viteOut = join(work, "vite-dist")
  let viteReport: { uploaded: number; failed: number } | undefined
  Object.assign(process.env, sdkEnv)
  await viteBuild({
    root: join(SDK, "examples/vite-app"),
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { "@bertha/sdk/browser": join(SDK, "dist/browser/index.js") } },
    build: { outDir: viteOut, emptyOutDir: true },
    plugins: [bertha({ onReport: (r) => (viteReport = r) })],
  })
  check(viteReport && viteReport.uploaded > 0 && viteReport.failed === 0, "maps uploaded", viteReport)
  const assets = readdirSync(join(viteOut, "assets"))
  check(!assets.some((f) => f.endsWith(".map")), "no maps left in dist")
  const main = assets.find((f) => f.endsWith(".js"))!
  check(/\/\/# debugId=[0-9a-f-]{36}\n$/.test(readFileSync(join(viteOut, "assets", main), "utf8")), "bundle carries its debug id")

  if (withNext) {
    step("Next.js: build with withBertha, start, hit a route that throws")
    const nextApp = join(SDK, "examples/next-app")
    check(existsSync(join(nextApp, "node_modules/next")), "examples/next-app is installed")
    rmSync(join(nextApp, ".next"), { recursive: true, force: true })
    const nextEnv = { ...sdkEnv, NEXT_PUBLIC_BERTHA_KEY: sdkEnv.BERTHA_KEY, NEXT_PUBLIC_BERTHA_URL: url, NEXT_TELEMETRY_DISABLED: "1" }
    const out = run("npx", ["next", "build"], { cwd: nextApp, env: nextEnv })
    const stamped = /\[bertha\] Uploaded (\d+) of (\d+) source maps/.exec(out)
    check(stamped && stamped[1] === stamped[2], "every map uploaded", out.split("\n").filter((l) => l.includes("bertha")))
    check(!readdirSync(join(nextApp, ".next/static/chunks"), { recursive: true }).some((f) => String(f).endsWith(".map")), "no maps left in .next/static")
    const nextPort = await freePort()
    start("npx", ["next", "start", "-p", String(nextPort)], { cwd: nextApp, env: nextEnv })
    await until("next start", async () => ((await fetch(`http://127.0.0.1:${nextPort}/`)).ok ? true : undefined), 30_000)
    const boom = await fetch(`http://127.0.0.1:${nextPort}/api/boom`)
    check(boom.status === 500, "/api/boom fails", boom.status)
    const before = new Set([nodeIssue.id])
    const nextIssue = await until("the Next error", async () => (await issues()).find((i) => !before.has(i.id) && i.message.includes("price")))
    const nextEvent = await latest(nextIssue.id)
    const nextTop = nextEvent.exception!.frames.find((f) => f.inApp)
    check(nextTop?.mapped && nextTop.file.endsWith("lib/checkout.ts"), "server frame mapped to lib/checkout.ts", nextEvent.exception!.frames.slice(0, 4))
    check(JSON.stringify(nextEvent).includes("/api/boom"), "request recorded")
  }
}

try {
  await main()
} catch (e) {
  failed = true
  console.error(e)
} finally {
  for (const c of children) c.kill("SIGTERM")
  if (!failed) rmSync(work, { recursive: true, force: true })
  else console.log(`\nKept ${work} for a look.`)
}
console.log(failed ? "\ne2e failed" : "\ne2e passed")
process.exit(failed ? 1 : 0)
