import { useState, type FormEvent } from "react"
import { ArrowLeft } from "lucide-react"
import type { EmailLinkHandoff } from "../../packet/contract/actions"
import type { SignInPage } from "../../packet/contract/pages"
import { backend } from "@/data/backend"
import { scenarioState } from "@/data/useLoadable"
import { Standalone } from "@/components/standalone/Standalone"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/form"
import { Mono } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { navigate } from "@/lib/router"

export function SignIn() {
  const preset = scenarioState<SignInPage>("/sign-in")?.sentTo ?? null
  const [sent, setSent] = useState<EmailLinkHandoff | null>(preset ? { sentTo: preset, returnsTo: "/" } : null)
  const [email, setEmail] = useState(preset ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    const r = await backend.signIn(email.trim())
    setBusy(false)
    if (r.ok) {
      if (sent) setResent(true)
      setSent(r.value)
    } else setError(r.message)
  }

  if (sent)
    return (
      <Standalone foot="Didn't arrive? Check spam, or the address for typos.">
        <div role="status">
          <h1 className="text-xl font-medium tracking-[-0.01em] text-foreground">Check your inbox.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a sign-in link to <Mono className="break-all text-foreground">{sent.sentTo}</Mono>. Open it on this device; it works once.
          </p>
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => (setSent(null), setResent(false))}>
              <ArrowLeft /> Different email
            </Button>
            <Button variant="outline" size="sm" disabled={busy || resent} onClick={() => void send()}>
              {busy ? "Sending…" : resent ? "Sent again" : "Send again"}
            </Button>
          </div>
          {/* The far side of the handoff: what clicking the emailed link leads to. */}
          <button
            className="mt-8 w-full rounded-md border border-dashed border-border px-3 py-2.5 text-left text-xs text-faint transition-colors hover:border-input hover:text-muted-foreground"
            onClick={() => {
              navigate(sent.returnsTo)
              toast({ tone: "quiet", body: <>Signed in as <span className="font-mono text-foreground">{sent.sentTo}</span>.</> })
            }}
          >
            Prototype only: pretend the link was opened →
          </button>
        </div>
      </Standalone>
    )

  return (
    <Standalone foot="bertha is invite-only. Accounts come from an invitation.">
      <h1 className="text-xl font-medium tracking-[-0.01em] text-foreground">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">We'll email you a link. No password to remember.</p>
      <form onSubmit={send} noValidate className="mt-6 flex flex-col gap-4">
        <Field
          label="Email"
          error={
            error ? (
              <>
                {error} <span className="text-muted-foreground">Use the address your invitation went to, or ask the owner for one.</span>
              </>
            ) : undefined
          }
        >
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!error}
              autoFocus
              type="email"
              autoComplete="email"
              className="font-mono"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => (setEmail(e.target.value), setError(null))}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Email me a link"}
        </Button>
      </form>
    </Standalone>
  )
}
