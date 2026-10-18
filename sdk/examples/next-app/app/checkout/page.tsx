"use client"

import { total } from "../../lib/checkout"

export default function Checkout() {
  return (
    <button type="button" onClick={() => (document.title = String(total([{ price: 5, qty: 1 }, undefined])))}>
      Check out
    </button>
  )
}
