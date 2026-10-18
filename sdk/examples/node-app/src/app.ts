import { init } from "@bigbertha/sdk/node"

import { total } from "./checkout.ts"

init()

function settle(): void {
  // A basket with a line that went missing: throws, crashes, and is reported.
  console.log(total([{ price: 5, qty: 1 }, undefined]))
}

setTimeout(settle, 50)
