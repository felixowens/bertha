import type { Backend } from "../../packet/contract/actions"
import { createFixtureBackend } from "./fixtures"
import { readScenario } from "./scenario"

/** The one seam: swap this for a real implementation of `Backend`. */
export const scenario = readScenario()
export const backend: Backend = createFixtureBackend(scenario)
