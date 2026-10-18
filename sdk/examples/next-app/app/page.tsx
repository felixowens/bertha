import Link from "next/link"

export default function Home() {
  return (
    <main>
      <h1>bertha example</h1>
      <p>
        <Link href="/checkout">Checkout</Link> throws in the browser. <a href="/api/boom">/api/boom</a> throws on the
        server.
      </p>
    </main>
  )
}
