#!/usr/bin/env node
/**
 * screenshot.ts — close the visual loop.
 *
 * Captures full-page PNGs at mobile / tablet / desktop using @playwright/cli,
 * dumps console errors + failed network requests to a file, and prints the
 * file paths so the agent reads them selectively. Never streams base64.
 *
 * Run from the prototype root:   node .prototype/screenshot.ts [url]
 *
 * Functional core (pure parsing/derivation) + imperative shell (process I/O).
 */
import { execFileSync, spawnSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { connect } from "node:net"

// ── breakpoints (as const, the source of truth) ──────────────────────────────
const BREAKPOINTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const
type Breakpoint = keyof typeof BREAKPOINTS

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SCRIPT_DIR, "..")

// ── config: parse, don't validate ────────────────────────────────────────────
type Config = { baseUrl: string; outDir: string }
const DEFAULT_CONFIG: Config = { baseUrl: "http://localhost:4321", outDir: ".prototype/shots" }

function parseConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CONFIG
  const o = raw as Record<string, unknown>
  const baseUrl =
    typeof o.baseUrl === "string" && /^https?:\/\//.test(o.baseUrl) ? o.baseUrl : DEFAULT_CONFIG.baseUrl
  const outDir = typeof o.outDir === "string" && o.outDir.length > 0 ? o.outDir : DEFAULT_CONFIG.outDir
  return { baseUrl, outDir }
}

function loadConfig(): Config {
  const path = join(SCRIPT_DIR, "config.json")
  if (!existsSync(path)) return DEFAULT_CONFIG
  try {
    return parseConfig(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return DEFAULT_CONFIG
  }
}

// ── pure helpers ─────────────────────────────────────────────────────────────
function hostPort(url: string): { host: string; port: number } {
  const u = new URL(url)
  return { host: u.hostname, port: Number(u.port) || (u.protocol === "https:" ? 443 : 80) }
}

/** Pull "Errors: E, Warnings: W" out of `playwright-cli console` output. */
function parseConsoleCounts(text: string): { errors: number; warnings: number } {
  const m = text.match(/Errors:\s*(\d+),\s*Warnings:\s*(\d+)/)
  return { errors: m ? Number(m[1]) : 0, warnings: m ? Number(m[2]) : 0 }
}

// ── imperative shell ─────────────────────────────────────────────────────────
type Runner = { cmd: string; pre: readonly string[] }

function resolveRunner(): Runner {
  const probe = spawnSync("playwright-cli", ["--help"], { stdio: "ignore" })
  if (!probe.error && probe.status === 0) return { cmd: "playwright-cli", pre: [] }
  return { cmd: "npx", pre: ["--yes", "@playwright/cli@latest"] }
}

function pw(runner: Runner, args: readonly string[]): string {
  try {
    return execFileSync(runner.cmd, [...runner.pre, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string }
    return (e.stdout ?? "") + (e.stderr ?? "")
  }
}

function isUp(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((res) => {
    const sock = connect({ host, port })
    const done = (ok: boolean) => {
      sock.destroy()
      res(ok)
    }
    sock.setTimeout(timeoutMs)
    sock.once("connect", () => done(true))
    sock.once("timeout", () => done(false))
    sock.once("error", () => done(false))
  })
}

async function ensureServer(baseUrl: string): Promise<void> {
  const { host, port } = hostPort(baseUrl)
  if (await isUp(host, port)) return
  process.stdout.write(`Dev server not running on ${host}:${port} — starting \`npm run dev\`…\n`)
  const log = join(SCRIPT_DIR, "dev.log")
  const out = openSync(log, "w")
  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out],
  })
  child.unref()
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isUp(host, port)) {
      process.stdout.write(`Dev server is up on ${host}:${port}.\n`)
      return
    }
  }
  process.stderr.write(
    `\nCould not start the dev server on ${host}:${port} within 30s.\n` +
      `Start it manually (\`npm run dev\`) and re-run, or check ${log}.\n`,
  )
  process.exit(1)
}

async function main(): Promise<void> {
  const cfg = loadConfig()
  const argUrl = process.argv[2]
  const baseUrl = argUrl && /^https?:\/\//.test(argUrl) ? argUrl : cfg.baseUrl

  const outDir = isAbsolute(cfg.outDir) ? cfg.outDir : join(ROOT, cfg.outDir)
  mkdirSync(outDir, { recursive: true })

  await ensureServer(baseUrl)

  const runner = resolveRunner()
  pw(runner, ["open", baseUrl])

  const shots: string[] = []
  for (const [name, { width, height }] of Object.entries(BREAKPOINTS) as [Breakpoint, { width: number; height: number }][]) {
    const file = join(outDir, `${name}.png`)
    pw(runner, ["resize", String(width), String(height)])
    pw(runner, ["screenshot", "--full-page", `--filename=${file}`])
    shots.push(file)
  }

  // diagnostics: console + errors + network
  const consoleAll = pw(runner, ["console"])
  const { errors, warnings } = parseConsoleCounts(consoleAll)
  const consoleErrors = errors > 0 ? pw(runner, ["console", "error"]) : ""
  const requests = pw(runner, ["requests"])
  const diagPath = join(outDir, "diagnostics.txt")
  writeFileSync(
    diagPath,
    [
      `# Diagnostics for ${baseUrl}`,
      ``,
      `## Console (${errors} errors, ${warnings} warnings)`,
      consoleAll.trim(),
      errors > 0 ? `\n## Console errors\n${consoleErrors.trim()}` : ``,
      ``,
      `## Network requests (non-static / failed)`,
      requests.trim(),
      ``,
    ].join("\n"),
  )

  pw(runner, ["close"])

  // report — paths only, never base64
  process.stdout.write(`\nScreenshots (${baseUrl}):\n`)
  for (const s of shots) process.stdout.write(`  ${s}\n`)
  process.stdout.write(`Diagnostics: ${diagPath}\n`)
  process.stdout.write(
    errors > 0
      ? `\n⚠ ${errors} console error(s) — read diagnostics before judging the visuals.\n`
      : `\nConsole clean (${warnings} warning(s)).\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`screenshot.ts failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
