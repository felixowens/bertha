// bertha deploy | bertha sourcemaps upload <dir> | bertha test

import { parseArgs } from "node:util"

import { deployCommit, detectRelease, processDirectory, reason, recordDeploy } from "./build/index.ts"
import type { IngestBatch } from "./generated/ingest.ts"
import { VERSION } from "./core/version.ts"

const HELP = `bertha ${VERSION}

Usage
  bertha deploy [--release <r>] [--env <environment>]
      Record a deploy, with the last commit's details.
  bertha sourcemaps upload <dir> [--release <r>] [--keep-maps]
      Give bundles in <dir> debug ids, upload their maps and remove the maps.
  bertha test [--env <environment>]
      Send one error marked as a test, to check the app's key reaches bertha.

Options
  --url <url>   bertha's URL. Default: BERTHA_URL, NEXT_PUBLIC_BERTHA_URL or VITE_BERTHA_URL.
  --key <key>   The project's upload key. Default: BERTHA_UPLOAD_KEY.
                For test, its connection key. Default: BERTHA_KEY, NEXT_PUBLIC_BERTHA_KEY or VITE_BERTHA_KEY.

The release defaults to BERTHA_RELEASE, the CI's commit sha, or git HEAD.`

export async function main(argv: string[], out: (s: string) => void = console.log): Promise<number> {
  let args
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        release: { type: "string" },
        env: { type: "string" },
        url: { type: "string" },
        key: { type: "string" },
        "keep-maps": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    })
  } catch (e) {
    out(`${(e as Error).message}\n\n${HELP}`)
    return 2
  }
  const { values: v, positionals: [command, ...rest] } = args
  if (v.version) return out(VERSION), 0
  if (v.help || !command) return out(HELP), command || v.help ? 0 : 2

  const url = v.url ?? process.env.BERTHA_URL ?? process.env.NEXT_PUBLIC_BERTHA_URL ?? process.env.VITE_BERTHA_URL
  const key = v.key ?? process.env.BERTHA_UPLOAD_KEY
  const release = v.release ?? detectRelease()

  if (command === "deploy") {
    if (!url || !key) return out("Set BERTHA_URL and BERTHA_UPLOAD_KEY, or pass --url and --key."), 1
    if (!release) return out("No release found. Pass --release or set BERTHA_RELEASE."), 1
    const environment = v.env ?? "production"
    // Without a checkout (a host's build step), the host still names the commit.
    const r = await recordDeploy({ url, uploadKey: key, release, environment, commit: deployCommit() })
    if (!r.ok) return out(r.message), 1
    out(`Recorded ${release} in ${environment} (${r.releaseId}).`)
    return 0
  }

  if (command === "test") {
    const ingestKey = v.key ?? process.env.BERTHA_KEY ?? process.env.NEXT_PUBLIC_BERTHA_KEY ?? process.env.VITE_BERTHA_KEY
    if (!url || !ingestKey) return out("Set BERTHA_URL and BERTHA_KEY, or pass --url and --key."), 1
    return sendTest(url, ingestKey, v.env ?? "development", out)
  }

  if (command === "sourcemaps" && rest[0] === "upload") {
    const dir = rest[1]
    if (!dir) return out("Which directory? bertha sourcemaps upload <dir>"), 2
    if (!url || !key) return out("Set BERTHA_URL and BERTHA_UPLOAD_KEY, or pass --url and --key."), 1
    try {
      const report = await processDirectory({ dir, release, url, uploadKey: key, keepMaps: v["keep-maps"], log: out })
      return report.failed > 0 ? 1 : 0
    } catch (e) {
      return out(`Couldn't process ${dir}: ${(e as Error).message}`), 1
    }
  }

  out(`Unknown command: ${[command, ...rest].join(" ")}\n\n${HELP}`)
  return 2
}

const TEST_MESSAGE = "bertha test event"

/** One error, grouped as its own issue and tagged, so it's easy to find and to ignore. */
async function sendTest(url: string, key: string, environment: string, out: (s: string) => void): Promise<number> {
  const batch: IngestBatch = {
    sdk: { name: "bertha.cli", version: VERSION },
    events: [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: "error",
        environment,
        exception: { type: "Error", message: TEST_MESSAGE, frames: [{ file: "bertha-cli", function: "test", inApp: false }] },
        tags: { test: "true" },
        fingerprint: ["bertha-test-event"],
      },
    ],
  }
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/ingest/v1/events`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return out(`bertha didn't accept the test event: ${await reason(res)}`), 1
  } catch (e) {
    return out(`Couldn't reach bertha at ${url}: ${(e as Error).message}`), 1
  }
  out(`Sent a test event in ${environment}. Look for "${TEST_MESSAGE}" in the project's issues; it's tagged test: true.`)
  return 0
}
