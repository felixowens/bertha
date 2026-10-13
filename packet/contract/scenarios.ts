// Shape of fixtures/scenarios.ts: named states the design must handle.
// `params` picks real data from the other fixtures (e.g. `issueId`, or `viewer` to view
// as a collaborator); `state` overrides part of that route's view model; `failure` makes
// one Backend mutation fail with the named kind when the user triggers it.
import type { Backend } from "./actions"
import type { Routes } from "./pages"

type FailureOf<K extends keyof Backend> =
  Awaited<ReturnType<Backend[K]>> extends infer R
    ? R extends { ok: false; failure: infer F } ? F : never
    : never

/** Every (operation, failure kind) pair the Backend can produce. */
export type FailureInjection = {
  [K in keyof Backend]: [FailureOf<K>] extends [never] ? never : { op: K; kind: FailureOf<K> }
}[keyof Backend]

export type Scenario = {
  [R in keyof Routes]: {
    id: string
    route: R
    description: string
    params?: Record<string, string>
    state?: Partial<Routes[R]>
    failure?: FailureInjection
  }
}[keyof Routes]
