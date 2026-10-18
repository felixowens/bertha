// bertha deploy | bertha sourcemaps upload <dir>

import { parseArgs } from "node:util"

import { detectRelease, lastCommit, processDirectory, reason } from "./build/index.ts"
import type { DeployRecorded, IngestDeploy } from "./generated/ingest.ts"
import { VERSION } from "./core/version.ts"

const HELP = `bertha ${VERSION}

Usage
  bertha deploy [--release <r>] [--env <environment>]
      Record a deploy, with the last commit's details.
  bertha sourcemaps upload <dir> [--release <r>] [--keep-maps]
      Give bundles in <dir> debug ids, upload their maps and remove the maps.

Options
  --url <url>   bertha's URL. Default: BERTHA_URL, NEXT_PUBLIC_BERTHA_URL or VITE_BERTHA_URL.
  --key <key>   The project's upload key. Default: BERTHA_UPLOAD_KEY.

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
    const body: IngestDeploy = { release, environment: v.env ?? "production" }
    const commit = lastCommit()
    if (commit) body.commit = commit
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/ingest/v1/deploys`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) return out(`bertha didn't record the deploy: ${await reason(res)}`), 1
      const recorded = (await res.json()) as DeployRecorded
      out(`Recorded ${release} in ${body.environment} (${recorded.releaseId}).`)
      return 0
    } catch (e) {
      return out(`Couldn't reach bertha at ${url}: ${(e as Error).message}`), 1
    }
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
