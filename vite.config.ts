import { readFileSync } from "node:fs"
import path from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { bertha } from "./sdk/src/vite/index.ts"

/** Where `npm run dev:api` finds the Rust server. */
const api = process.env.BERTHA_API ?? "http://127.0.0.1:3000"

/** The release version, from the server's workspace (scripts/version.sh keeps it in step). The app ships inside that binary, so they always match. */
const version = /^\[workspace\.package\]\s*\nversion = "([^"]+)"/m.exec(
  readFileSync(path.resolve(import.meta.dirname, "server/Cargo.toml"), "utf8"),
)?.[1]
if (!version) throw new Error("No version under [workspace.package] in server/Cargo.toml.")

/**
 * Fails a production build that pulls in the fixtures. They're for `npm run dev` only,
 * behind `import.meta.env.DEV`; one import outside that gate would ship the sample data.
 */
function noFixtures(): Plugin {
  const fixture = /[\\/]fixtures[\\/]|[\\/]src[\\/]data[\\/](fixtures|scenario)\.ts$/
  return {
    name: "bertha:no-fixtures",
    apply: "build",
    generateBundle(_, bundle) {
      const leaked = Object.values(bundle)
        .flatMap((c) => (c.type === "chunk" ? Object.keys(c.modules) : []))
        .filter((id) => fixture.test(id))
      if (leaked.length) {
        this.error(`The production bundle includes fixtures: ${leaked.map((id) => path.relative(import.meta.dirname, id)).join(", ")}. Import them only behind import.meta.env.DEV.`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Debug ids and source maps, kept in dist: the server stores them for the project it
  // reports its own errors to (BERTHA_REPORT_TO), so nothing is uploaded at build time.
  plugins: [react(), tailwindcss(), noFixtures(), bertha({ release: version, uploadKey: "", keepMaps: true })],
  define: { __BERTHA_VERSION__: JSON.stringify(version) },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: {
    port: 4321,
    strictPort: true,
    proxy: {
      "/api": { target: api },
      "/auth": { target: api },
    },
  },
})
