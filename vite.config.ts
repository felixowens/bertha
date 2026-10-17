import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/** Where `npm run dev:api` finds the Rust server. */
const api = process.env.BERTHA_API ?? "http://127.0.0.1:3000"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    port: 4321,
    strictPort: true,
    proxy: {
      "/api": { target: api },
      "/auth": { target: api },
    },
  },
})
