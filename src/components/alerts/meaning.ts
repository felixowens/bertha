import type { AlertDestination } from "../../../packet/contract/domain"

export const destName = (d: AlertDestination) => (d.kind === "email" ? d.address : d.label)
