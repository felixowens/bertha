// Records a deploy with bertha: `bertha deploy` in CI, and withBertha on Vercel.

import type { DeployRecorded, IngestDeploy } from "../generated/ingest.ts"
import { env, envCommit } from "../core/env.ts"
import { type Commit, lastCommit } from "./release.ts"
import { reason } from "./index.ts"

export interface DeployOptions {
  url: string
  uploadKey: string
  release: string
  environment: string
  commit?: Commit
}

export type DeployResult = { ok: true; releaseId: string } | { ok: false; message: string }

/** The commit being deployed: the checkout's, else what the host says (Vercel names it in full). */
export function deployCommit(cwd?: string): Commit | undefined {
  const vercel = env("VERCEL_GIT_COMMIT_SHA")
  if (vercel) {
    return { sha: vercel, message: env("VERCEL_GIT_COMMIT_MESSAGE") ?? "", author: env("VERCEL_GIT_COMMIT_AUTHOR_NAME") ?? "" }
  }
  const sha = envCommit()
  return lastCommit(cwd) ?? (sha ? { sha, message: "", author: "" } : undefined)
}

export async function recordDeploy(o: DeployOptions): Promise<DeployResult> {
  const body: IngestDeploy = { release: o.release, environment: o.environment }
  if (o.commit) body.commit = o.commit
  try {
    const res = await fetch(`${o.url.replace(/\/+$/, "")}/ingest/v1/deploys`, {
      method: "POST",
      headers: { authorization: `Bearer ${o.uploadKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { ok: false, message: `bertha didn't record the deploy: ${await reason(res)}` }
    return { ok: true, releaseId: ((await res.json()) as DeployRecorded).releaseId }
  } catch (e) {
    return { ok: false, message: `Couldn't reach bertha at ${o.url}: ${(e as Error).message}` }
  }
}
