import { createFixtureBackend } from "./fixtures"
import { readScenario } from "./scenario"

/** Dev only: the prototype's fixture backend, steered by `?scenario=`. */
export const scenario = readScenario()
export const backend = createFixtureBackend(scenario)
