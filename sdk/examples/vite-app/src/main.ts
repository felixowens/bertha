import { init } from "@bigbertha/sdk/browser"

import { total } from "./checkout.ts"

init({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })

document.querySelector("#boom")?.addEventListener("click", () => {
  document.title = String(total([{ price: 5, qty: 1 }, undefined]))
})
