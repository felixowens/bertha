"use client"

import { captureException } from "@bertha/sdk/next/client"
import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureException(error)
  }, [error])
  return (
    <html lang="en">
      <body>
        <p>Something went wrong.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  )
}
