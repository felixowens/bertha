// What the end-to-end suite runs against: the real bertha binary on a fresh database,
// an SMTP sink it sends mail to, a small site that can be switched off and a fake GitHub.
// All local.

import { execFileSync, spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs"
import { createServer as createHttp, type Server } from "node:http"
import { createServer as createTcp, type AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

export type Mail = { to: string[]; subject: string; body: string }

const listen = (s: Server | ReturnType<typeof createTcp>, port = 0) =>
  new Promise<number>((done, fail) => {
    s.once("error", fail)
    s.listen(port, "127.0.0.1", () => done((s.address() as AddressInfo).port))
  })

async function freePort(): Promise<number> {
  const s = createTcp()
  const port = await listen(s)
  await new Promise((done) => s.close(done))
  return port
}

function decode(raw: string): Omit<Mail, "to"> {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/)
  // Unfold continued header lines, then read the ones we need.
  const headers = new Map<string, string>()
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":")
    if (i > 0) headers.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim())
  }
  let body = rest.join("\n\n")
  const enc = headers.get("content-transfer-encoding")?.toLowerCase()
  if (enc === "base64") body = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf8")
  if (enc === "quoted-printable")
    body = Buffer.from(
      body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
      "latin1",
    ).toString("utf8")
  let subject = headers.get("subject") ?? ""
  // RFC 2047 encoded words, which lettre uses for anything beyond ASCII.
  subject = subject.replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, kind: string, text: string) =>
    kind.toLowerCase() === "b"
      ? Buffer.from(text, "base64").toString("utf8")
      : Buffer.from(text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"),
  )
  return { subject, body: body.replace(/\r\n/g, "\n") }
}

/** A minimal SMTP server that keeps every message, and an HTTP side to read them. */
export async function smtpSink(onMail?: (m: Mail) => void) {
  const mails: Mail[] = []
  const smtp = createTcp((sock) => {
    let buf = ""
    let data: string[] | null = null
    let to: string[] = []
    const reply = (s: string) => sock.write(`${s}\r\n`)
    reply("220 sink ESMTP")
    sock.on("data", (chunk) => {
      buf += chunk.toString("latin1")
      for (;;) {
        const i = buf.indexOf("\r\n")
        if (i < 0) break
        const line = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (data) {
          if (line === ".") {
            const m = decode(Buffer.from(data.join("\r\n"), "latin1").toString("utf8"))
            mails.push({ ...m, to })
            onMail?.({ ...m, to })
            data = null
            to = []
            reply("250 OK queued")
          } else data.push(line.startsWith("..") ? line.slice(1) : line)
          continue
        }
        const verb = line.slice(0, 4).toUpperCase()
        if (verb === "EHLO") reply("250-sink\r\n250 8BITMIME")
        else if (verb === "HELO") reply("250 sink")
        else if (verb === "MAIL" || verb === "RSET" || verb === "NOOP") reply("250 OK")
        else if (verb === "RCPT") {
          to.push(line.replace(/^RCPT TO:\s*<?([^>]*)>?.*$/i, "$1"))
          reply("250 OK")
        } else if (verb === "DATA") {
          data = []
          reply("354 End data with <CR><LF>.<CR><LF>")
        } else if (verb === "QUIT") {
          reply("221 Bye")
          sock.end()
        } else reply("502 Not implemented")
      }
    })
    sock.on("error", () => {})
  })
  const http = createHttp((req, res) => {
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify(mails))
  })
  return { smtpPort: await listen(smtp), httpPort: await listen(http), close: () => (smtp.close(), http.close()) }
}

/** A site whose /health answers 200 or 503, switched with POST /up and POST /down. */
export async function flakySite(port = 0) {
  let up = true
  const server = createHttp((req, res) => {
    if (req.method === "POST") {
      up = req.url === "/up"
      res.end()
      return
    }
    res.statusCode = up ? 200 : 503
    res.end(up ? "ok" : "down")
  })
  return { port: await listen(server, port), close: () => server.close() }
}

/** The two GitHub reads bertha makes to follow a fix. Every PR is open until
 * `POST /merge/:owner/:repo/:n?sha=` merges it; a release contains a fix once
 * `POST /ship/:owner/:repo?fix=&release=` says so. */
export async function fakeGithub(port = 0) {
  const merged = new Map<string, { sha: string; at: string }>()
  const shipped = new Set<string>()
  const server = createHttp((req, res) => {
    const u = new URL(req.url ?? "/", "http://fake")
    const send = (status: number, body: object) => {
      res.statusCode = status
      res.setHeader("content-type", "application/json")
      res.end(JSON.stringify(body))
    }
    let m: RegExpMatchArray | null
    if (req.method === "POST" && (m = u.pathname.match(/^\/merge\/([^/]+\/[^/]+)\/(\d+)$/))) {
      merged.set(`${m[1]}#${m[2]}`, { sha: u.searchParams.get("sha")!, at: new Date().toISOString() })
      return send(200, {})
    }
    if (req.method === "POST" && (m = u.pathname.match(/^\/ship\/([^/]+\/[^/]+)$/))) {
      shipped.add(`${m[1]} ${u.searchParams.get("fix")}...${u.searchParams.get("release")}`)
      return send(200, {})
    }
    if (req.headers.authorization !== "Bearer e2e-github-token") return send(401, { message: "Bad credentials" })
    if ((m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)$/))) {
      const done = merged.get(`${m[1]}#${m[2]}`)
      return send(200, done
        ? { state: "closed", merged: true, merge_commit_sha: done.sha, merged_at: done.at }
        : { state: "open", merged: false, merge_commit_sha: null, merged_at: null })
    }
    if ((m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/compare\/(.+)$/))) {
      return send(200, { status: shipped.has(`${m[1]} ${decodeURIComponent(m[2])}`) ? "ahead" : "behind" })
    }
    send(404, { message: "Not Found" })
  })
  return { port: await listen(server, port), close: () => server.close() }
}

const ROOT = resolve(import.meta.dirname, "..")

/** The binary under test: BERTHA_BIN, else a release build, else a debug build. Either
 * needs the `fixtures` feature for the fast-check setting the suite relies on. */
export function binary(): string {
  const candidates = [process.env.BERTHA_BIN, join(ROOT, "server/target/release/bertha"), join(ROOT, "server/target/debug/bertha")]
  const bin = candidates.find((c) => c && existsSync(c))
  if (!bin) throw new Error("No bertha binary. Run: npm run build && (cd server && cargo build --release --features fixtures)")
  return bin
}

export async function startBertha(smtpPort: number, githubPort: number) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "bertha-pw-")))
  const port = await freePort()
  const env = {
    BERTHA_URL: `http://127.0.0.1:${port}`,
    BERTHA_BIND: `127.0.0.1:${port}`,
    DATABASE_PATH: join(dir, "bertha.db"),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpPort),
    SMTP_SECURITY: "none",
    SMTP_FROM: "bertha <bertha@e2e.test>",
    BERTHA_CHECK_EVERY_SECONDS: "1",
    BERTHA_REGION: "e2e",
    BERTHA_GITHUB_API: `http://127.0.0.1:${githubPort}`,
    BERTHA_GITHUB_TOKEN: "e2e-github-token",
    RUST_LOG: "info,tower_http=warn,sqlx=warn",
  }
  const bin = binary()
  const cli = (...args: string[]) => execFileSync(bin, args, { env: { ...process.env, ...env }, encoding: "utf8" })
  cli("owner", "create", "owner@e2e.test", "--name", "Olu Owner")

  const child: ChildProcess = spawn(bin, ["serve"], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] })
  let log = ""
  child.stdout!.on("data", (d: Buffer) => (log += d))
  child.stderr!.on("data", (d: Buffer) => (log += d))
  const end = Date.now() + 15_000
  for (;;) {
    const ok = await fetch(`${env.BERTHA_URL}/healthz`).then((r) => r.ok, () => false)
    if (ok) break
    if (child.exitCode !== null || Date.now() > end) throw new Error(`bertha didn't start:\n${log}`)
    await sleep(100)
  }
  return {
    url: env.BERTHA_URL,
    env,
    log: () => log,
    stop: async () => {
      child.kill("SIGTERM")
      await new Promise((done) => (child.exitCode !== null ? done(null) : child.once("exit", done)))
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
