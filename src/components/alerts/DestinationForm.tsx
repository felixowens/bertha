import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { AlertDestination, AlertRule } from "../../contract/domain"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Segmented } from "@/components/ui/form"
import { InlineError } from "@/components/ui/states"

/** Add a destination, or edit one: fix a rotated webhook URL in place, or delete it. */
export function DestinationForm({
  open,
  onOpenChange,
  onSaved,
  initial,
  rules = [],
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (d: AlertDestination) => void
  initial?: AlertDestination
  /** Every rule, to say which ones a delete would leave with nowhere to send. */
  rules?: AlertRule[]
  onDeleted?: (rulesTurnedOff: string[]) => void
}) {
  const [kind, setKind] = useState<"email" | "webhook">(initial?.kind ?? "email")
  const [address, setAddress] = useState(initial?.kind === "email" ? initial.address : "")
  const [label, setLabel] = useState(initial?.kind === "webhook" ? initial.label : "")
  const [url, setUrl] = useState(initial?.kind === "webhook" ? initial.url : "")
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<{ kind: "invalid_email" | "invalid_webhook" | "not_found"; message: string } | null>(null)

  const using = initial ? rules.filter((r) => r.destinationIds.includes(initial.id)) : []
  const stranded = initial ? using.filter((r) => r.destinationIds.length === 1) : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const id = initial?.id
    const r = await backend.saveDestination(
      kind === "email" ? { id, kind, address: address.trim() } : { id, kind, label: label.trim() || new URL(url.trim(), "https://x").hostname, url: url.trim() },
    )
    setBusy(false)
    if (r.ok) {
      onSaved(r.value)
      onOpenChange(false)
    } else setError({ kind: r.failure, message: r.message })
  }

  const remove = async () => {
    if (!initial) return
    setBusy(true)
    const r = await backend.deleteDestination(initial.id)
    setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onDeleted?.(r.value.rulesTurnedOff)
    } else {
      setDeleting(false)
      setError({ kind: r.failure, message: r.message })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit destination" : "Add a destination"}
      description={initial ? "Rules using it keep using it." : "Where alerts go. Send a test once it's added."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!initial && (
          <Segmented
            label="Kind"
            value={kind}
            onChange={(k) => {
              setKind(k)
              setError(null)
            }}
            options={[
              { value: "email", label: "Email" },
              { value: "webhook", label: "Webhook" },
            ]}
          />
        )}
        {kind === "email" ? (
          <Field
            label="Email address"
            error={
              error?.kind === "invalid_email" ? (
                <>
                  {error.message} <span className="text-muted-foreground">It needs a domain, like name@example.com.</span>
                </>
              ) : undefined
            }
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={error?.kind === "invalid_email"}
                type="text"
                inputMode="email"
                autoFocus
                className="font-mono"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>
        ) : (
          <>
            <Field
              label="Webhook URL"
              hint="bertha POSTs JSON to it. Works with chat apps and push services."
              error={error?.kind === "invalid_webhook" ? error.message : undefined}
            >
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  aria-invalid={error?.kind === "invalid_webhook"}
                  autoFocus
                  className="font-mono"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field label="Label" hint="Optional. How it appears in rules, e.g. “Phone push”.">
              {(id, d) => <Input id={id} aria-describedby={d} value={label} onChange={(e) => setLabel(e.target.value)} />}
            </Field>
          </>
        )}

        {error?.kind === "not_found" && <InlineError>{error.message}</InlineError>}

        {deleting ? (
          <div className="flex flex-col gap-2 rounded-md border border-danger/25 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              {using.length === 0 ? (
                "Delete this destination? No rules use it."
              ) : stranded.length ? (
                <>
                  Delete this destination? It comes off {using.length === 1 ? "1 rule" : `${using.length} rules`}, and{" "}
                  {stranded
                    .map((r) => (
                      <span key={r.id} className="text-foreground">
                        {r.name}
                      </span>
                    ))
                    .reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, i === stranded.length - 1 ? " and " : ", ", x] : [x]), [])}{" "}
                  {stranded.length === 1 ? "has" : "have"} nowhere else to send, so {stranded.length === 1 ? "it turns" : "they turn"} off.
                </>
              ) : (
                <>Delete this destination? It comes off {using.length === 1 ? "1 rule" : `${using.length} rules`}; they still send elsewhere.</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setDeleting(false)}>
                Keep
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
                {busy ? "Deleting…" : "Delete destination"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {initial && onDeleted && (
              <Button type="button" variant="ghost" className="mr-auto text-danger hover:text-danger" disabled={busy} onClick={() => setDeleting(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !(kind === "email" ? address.trim() : url.trim())}>
              {busy ? "Saving…" : initial ? "Save" : "Add destination"}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  )
}
