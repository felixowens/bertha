// @bigbertha/sdk/next/config, for next.config.ts:
//   export default withBertha(nextConfig)
// Turns on source maps for production builds, stamps the release and environment
// (BERTHA_ENVIRONMENT, else Vercel's production or preview), and after each
// build gives bundles debug ids, uploads the maps and removes them from `.next`.

import { join } from "node:path"

import { detectRelease, processDirectory } from "../build/index.ts"
import { firstEnv } from "../core/env.ts"

export interface BerthaNextOptions {
  release?: string
  /**
   * Which .map files stay in `.next` after uploading, by path inside it. Defaults to
   * the server's: only `static/` is served to browsers, and removing server maps can
   * break Vercel's build output (getsentry/sentry-javascript#13099).
   */
  keepMaps?: boolean | ((file: string) => boolean)
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

export const keepServerMaps = (file: string): boolean => !file.startsWith("static/")

export function withBertha<C extends object>(config: C = {} as C, options: BerthaNextOptions = {}): C {
  const c = config as NextConfigLike
  const release = options.release ?? detectRelease()
  const environment = firstEnv("BERTHA_ENVIRONMENT", "VERCEL_ENV")
  const previous = c.compiler?.runAfterProductionCompile
  const next: NextConfigLike = {
    ...c,
    productionBrowserSourceMaps: true,
    env: {
      ...c.env,
      ...(release ? { BERTHA_RELEASE: release } : {}),
      ...(environment ? { BERTHA_ENVIRONMENT: environment } : {}),
    },
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
          keepMaps: options.keepMaps ?? keepServerMaps,
          skip: ["cache", "standalone", "types"],
          log: (m) => console.log(`[bertha] ${m}`),
        }).catch((e: unknown) => console.warn(`[bertha] Source maps weren't processed: ${String(e)}`))
      },
    },
  }
  return next as C
}
