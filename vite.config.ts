import { readFileSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/** Where `npm run dev:api` finds the Rust server. */
const api = process.env.BERTHA_API ?? "http://127.0.0.1:3000"

/** The release version, from the server's workspace (scripts/version.sh keeps it in step). The app ships inside that binary, so they always match. */
const version = /^\[workspace\.package\]\s*\nversion = "([^"]+)"/m.exec(
  readFileSync(path.resolve(import.meta.dirname, "server/Cargo.toml"), "utf8"),
)?.[1]
if (!version) throw new Error("No version under [workspace.package] in server/Cargo.toml.")

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
