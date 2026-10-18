import { resolve } from "node:path"

import { withBertha } from "@bertha/sdk/next/config"
import type { NextConfig } from "next"

// Only because this example links the SDK from two folders up.
const root = resolve(process.cwd(), "../..")

const nextConfig: NextConfig = { turbopack: { root }, outputFileTracingRoot: root }

export default withBertha(nextConfig)
