import { freezeClock } from "@/lib/clock"
import { createFixtureBackend, NOW } from "./fixtures"
import { readScenario, seedUrl } from "./scenario"

/** Dev only: the prototype's fixture backend, steered by `?scenario=`. */
freezeClock(NOW.getTime())

seedUrl()
export const scenario = readScenario()
export const backend = createFixtureBackend(scenario)
