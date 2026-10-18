import { total } from "../../../lib/checkout"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({ total: total([{ price: 5, qty: 1 }, undefined]) })
}
