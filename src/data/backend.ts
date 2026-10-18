import type { Backend } from "../contract/actions"
import { createHttpBackend, signOut as signOutHttp } from "./http"
import { navigate } from "@/lib/router"
import type { ActiveScenario } from "./scenario"

/**
 * The one seam. Production always talks to the server. In dev, the fixture backend
 * (with `?scenario=`) is the default and `npm run dev:api` uses the server instead.
 * The fixtures are a dynamic import so they never ship in a production build.
 */
export const usesFixtures = import.meta.env.DEV && import.meta.env.VITE_BACKEND !== "http"

/** No scenario: every read is live. */
const LIVE: ActiveScenario = { id: null, reads: "normal", failure: null, named: null, params: {} }

const fixtureMode = usesFixtures ? await import("./fixtureMode") : null

export const scenario: ActiveScenario = fixtureMode?.scenario ?? LIVE
export const backend: Backend = fixtureMode?.backend ?? createHttpBackend()

/** Ends the session. Not part of `Backend`: the contract has no sign-out. */
export function signOut(): Promise<void> {
  if (usesFixtures) {
    navigate("/sign-in")
    return Promise.resolve()
  }
  return signOutHttp()
}
