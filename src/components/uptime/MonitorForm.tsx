import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { Monitor, Project } from "../../contract/domain"
import type { MonitorInput } from "../../contract/actions"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Segmented, Select } from "@/components/ui/form"
import { InlineError } from "@/components/ui/states"

const INTERVALS: { value: MonitorInput["intervalSeconds"]; label: string }[] = [
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
]

/** Add or edit a monitor. bertha runs a first check before saving. */
export function MonitorForm({
  open,
  onOpenChange,
  projects,
  initial,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projects: Project[]
  initial?: Monitor
  onSaved: (m: Monitor) => void
  /** Given only to the owner: offers Delete when editing. */
  onDeleted?: () => void
}) {
  // A new monitor is most likely for a project that has none yet, at the project's own URL.
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects.find((p) => !p.monitorIds.length)?.id ?? projects[0]?.id ?? "")
  const urlOf = (id: string) => projects.find((p) => p.id === id)?.url ?? ""
  const [name, setName] = useState(initial?.name ?? "")
  const [url, setUrl] = useState(initial?.url ?? urlOf(projectId))
  const [interval, setInterval] = useState<MonitorInput["intervalSeconds"]>((initial?.intervalSeconds as MonitorInput["intervalSeconds"]) ?? 60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "invalid_url" | "unreachable" | "not_found" | "permission_denied"; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    if (!initial) return
    setBusy(true)
    const r = await backend.deleteMonitor(initial.id)
    setBusy(false)
    if (r.ok) {
      onOpenChange(false)
      onDeleted?.()
    } else {
      setDeleting(false)
      setError({ kind: r.failure, message: r.message })
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.saveMonitor({
      id: initial?.id,
      projectId,
      name: name.trim() || url.replace(/^https?:\/\//, ""),
      url: url.trim(),
      intervalSeconds: interval,
      paused: initial?.state === "paused",
    })
    setBusy(false)
    if (r.ok) {
      onSaved(r.value)
      onOpenChange(false)
    } else setError({ kind: r.failure, message: r.message })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Edit monitor" : "Add a monitor"}
      description="bertha requests the URL on a schedule and alerts when it stops answering."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="URL"
          hint="The page or health endpoint to request. Any 2xx or 3xx counts as up."
          error={
            error?.kind === "invalid_url" ? (
              <>
                {error.message.replace(/([^.!?])$/, "$1.")} Include the scheme and domain, like <span className="font-mono">https://example.com/health</span>.
              </>
            ) : undefined
          }
        >
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={error?.kind === "invalid_url" || undefined}
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              spellCheck={false}
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Name" hint="Optional. Defaults to the URL.">
          {(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Checkout" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Project">
            {(id) => (
              <Select
                id={id}
                value={projectId}
                onChange={(e) => {
                  if (!initial && url === urlOf(projectId)) setUrl(urlOf(e.target.value))
                  setProjectId(e.target.value)
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Check every</span>
            <Segmented label="Check every" value={interval} options={INTERVALS} onChange={setInterval} />
          </div>
        </div>

        {error?.kind === "unreachable" && (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5">
            <InlineError>{error.message}</InlineError>
            <p className="mt-1 pl-4 text-xs text-muted-foreground">Nothing was saved. Check the address resolves, then try again.</p>
          </div>
        )}

        {(error?.kind === "not_found" || error?.kind === "permission_denied") && <InlineError>{error.message}</InlineError>}

        {deleting ? (
          <div className="mt-1 flex flex-wrap items-center justify-end gap-2 rounded-md border border-danger/25 px-3 py-2">
            <span className="mr-auto text-xs text-muted-foreground">Delete this monitor? Checks stop and its history goes.</span>
            <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setDeleting(false)}>
              Keep
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting…" : "Delete monitor"}
            </Button>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-end gap-2">
            {initial && onDeleted && (
              <Button type="button" variant="ghost" className="mr-auto text-danger hover:text-danger" disabled={busy} onClick={() => setDeleting(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || busy}>
              {busy ? (initial ? "Checking…" : "Running first check…") : initial ? "Save" : "Add monitor"}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  )
}
