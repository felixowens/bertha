// @bigbertha/sdk/vite: plugins: [bertha()]
// Builds with hidden source maps, then gives bundles debug ids, uploads the maps
// and removes them from the output. Reads BERTHA_UPLOAD_KEY and VITE_BERTHA_URL
// (or BERTHA_URL) from the environment or .env files.

import { resolve } from "node:path"

import { detectRelease, processDirectory, type Report } from "../build/index.ts"

export interface BerthaViteOptions {
  release?: string
  url?: string
  uploadKey?: string
  /** Keep .map files in the output after uploading. Default false. */
  keepMaps?: boolean
  /** Called with what was uploaded, for tests and custom logging. */
  onReport?: (report: Report) => void
}

// The parts of Vite's plugin API this uses, so Vite needn't be a dependency.
interface ResolvedConfig {
  root: string
  mode: string
  build: { outDir: string; ssr?: unknown }
  logger: { info(msg: string): void; warn(msg: string): void }
}

export interface VitePlugin {
  name: string
  apply: "build"
  enforce: "post"
  config(config: { build?: { sourcemap?: unknown } }): { build: { sourcemap: "hidden" } } | undefined
  configResolved(config: ResolvedConfig): Promise<void>
  closeBundle: { order: "post"; sequential: true; handler(): Promise<void> }
}

export function bertha(options: BerthaViteOptions = {}): VitePlugin {
  let outDir = ""
  let root = ""
  let env: Record<string, string> = {}
  let logger: ResolvedConfig["logger"] | undefined
  return {
    name: "bertha",
    apply: "build",
    enforce: "post",
    config(config) {
      if (!config.build?.sourcemap) return { build: { sourcemap: "hidden" } }
      return undefined
    },
    async configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
      logger = config.logger
      try {
        const vite = (await import("vite" as string)) as { loadEnv(mode: string, dir: string, prefix: string): Record<string, string> }
        env = vite.loadEnv(config.mode, config.root, "")
      } catch {
        env = {}
      }
    },
    closeBundle: {
      order: "post",
      sequential: true,
      async handler() {
        const pick = (...names: string[]) => names.map((n) => process.env[n] || env[n]).find(Boolean)
        try {
          const report = await processDirectory({
            dir: outDir,
            release: options.release ?? pick("BERTHA_RELEASE") ?? detectRelease(root),
            url: options.url ?? pick("BERTHA_URL", "VITE_BERTHA_URL"),
            uploadKey: options.uploadKey ?? pick("BERTHA_UPLOAD_KEY"),
            keepMaps: options.keepMaps,
            log: (m) => logger?.info(`[bertha] ${m}`),
          })
          options.onReport?.(report)
        } catch (e) {
          logger?.warn(`[bertha] Source maps weren't processed: ${String(e)}`)
        }
      },
    },
  }
}
