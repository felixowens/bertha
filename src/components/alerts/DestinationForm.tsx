import { useState } from "react"
import type { AlertDestination } from "../../contract/domain"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Segmented } from "@/components/ui/form"

export function DestinationForm({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: (d: AlertDestination) => void }) {
  const [kind, setKind] = useState<"email" | "webhook">("email")
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "invalid_email" | "invalid_webhook"; message: string } | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.saveDestination(kind === "email" ? { kind, address: address.trim() } : { kind, label: label.trim() || new URL(url.trim(), "https://x").hostname, url: url.trim() })
    setBusy(false)
    if (r.ok) {
      onSaved(r.value)
      onOpenChange(false)
    } else setError({ kind: r.failure, message: r.message })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add a destination" description="Where alerts go. Send a test once it's added.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Segmented label="Kind" value={kind} onChange={(k) => { setKind(k); setError(null) }} options={[{ value: "email", label: "Email" }, { value: "webhook", label: "Webhook" }]} />
        {kind === "email" ? (
          <Field label="Email address" error={error?.kind === "invalid_email" ? <>{error.message} <span className="text-muted-foreground">It needs a domain, like name@example.com.</span></> : undefined}>
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={error?.kind === "invalid_email"} type="text" inputMode="email" autoFocus className="font-mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="you@example.com" />}
          </Field>
        ) : (
          <>
            <Field label="Webhook URL" hint="bertha POSTs JSON to it. Works with chat apps and push services." error={error?.kind === "invalid_webhook" ? error.message : undefined}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={error?.kind === "invalid_webhook"} autoFocus className="font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}
            </Field>
            <Field label="Label" hint="Optional. How it appears in rules, e.g. “Phone push”.">
              {(id, d) => <Input id={id} aria-describedby={d} value={label} onChange={(e) => setLabel(e.target.value)} />}
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !(kind === "email" ? address.trim() : url.trim())}>
            {busy ? "Adding…" : "Add destination"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
