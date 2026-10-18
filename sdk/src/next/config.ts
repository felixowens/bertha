// @bigbertha/sdk/next/config, for next.config.ts:
//   export default withBertha(nextConfig)
// Turns on source maps for production builds, stamps the release, and after each
// build gives bundles debug ids, uploads the maps and removes them from `.next`.

import { join } from "node:path"

import { detectRelease, processDirectory } from "../build/index.ts"
import { firstEnv } from "../core/env.ts"

export interface BerthaNextOptions {
  release?: string
  /** Keep .map files in `.next` after uploading. Default false. */
  keepMaps?: boolean
  /** Skip the post-build step entirely (the release is still stamped). */
  disableUpload?: boolean
}

type RunAfter = (meta: { distDir: string; projectDir: string }) => Promise<void> | void

interface NextConfigLike {
  productionBrowserSourceMaps?: boolean
  env?: Record<string, string | undefined>
  experimental?: Record<string, unknown>
  compiler?: { runAfterProductionCompile?: RunAfter } & Record<string, unknown>
  [key: string]: unknown
}

export function withBertha<C extends object>(config: C = {} as C, options: BerthaNextOptions = {}): C {
  const c = config as NextConfigLike
  const release = options.release ?? detectRelease()
  const previous = c.compiler?.runAfterProductionCompile
  const next: NextConfigLike = {
    ...c,
    productionBrowserSourceMaps: true,
    env: { ...c.env, ...(release ? { BERTHA_RELEASE: release } : {}) },
    experimental: { ...c.experimental, serverSourceMaps: true },
    compiler: {
      ...c.compiler,
      async runAfterProductionCompile(meta) {
        await previous?.(meta)
        if (options.disableUpload) return
        await processDirectory({
          dir: meta.distDir ?? join(meta.projectDir, ".next"),
          release,
          url: firstEnv("BERTHA_URL", "NEXT_PUBLIC_BERTHA_URL"),
          uploadKey: firstEnv("BERTHA_UPLOAD_KEY"),
          keepMaps: options.keepMaps,
          skip: ["cache", "standalone", "types"],
          log: (m) => console.log(`[bertha] ${m}`),
        }).catch((e: unknown) => console.warn(`[bertha] Source maps weren't processed: ${String(e)}`))
      },
    },
  }
  return next as C
}
