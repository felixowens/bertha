import { useState } from "react"
import { Trash2 } from "lucide-react"
import type { AlertDestination, AlertRule, AlertTrigger, Environment, LogLevel, LogMatch, Project } from "../../contract/domain"
import type { AlertRuleInput } from "../../contract/actions"
import { backend } from "@/data/backend"
import { Button } from "@/components/ui/button"
import { Checks, Dialog, Field, Input, Segmented, Select, Switch } from "@/components/ui/form"
import { InlineError } from "@/components/ui/states"
import { envShort, logLevelAtLeast, triggerLabel } from "@/lib/meaning"
import { LOG_LEVELS } from "@/lib/logs"
import { destName } from "./meaning"

const TRIGGERS: AlertTrigger[] = ["new_issue", "regression", "spike", "monitor_down", "monitor_degraded", "monitor_recovered", "log_match"]
const TRIGGER_HINT: Record<AlertTrigger, string> = {
  new_issue: "An error bertha hasn't seen before",
  regression: "A resolved issue happens again",
  spike: "Lots of events in a short time",
  monitor_down: "An uptime check starts failing",
  monitor_degraded: "A site answers slowly or its certificate is about to expire",
  monitor_recovered: "It answers again",
  log_match: "A log search matches enough lines",
}
const LOG_MATCH: LogMatch = { query: "", minLevel: "warning", count: 5, withinMinutes: 30 }

type Failure = { kind: "no_destination" | "no_trigger" | "not_found"; message: string }

/** Create or edit one alert rule. Reads as a sentence: when, where, tell whom. */
export function RuleForm({
  open,
  onOpenChange,
  initial,
  preset,
  projects,
  environments,
  destinations,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial?: AlertRule
  /** What a new rule starts with, e.g. from a log search. */
  preset?: Partial<AlertRule>
  projects: Project[]
  environments: Environment[]
  destinations: AlertDestination[]
  onSaved: (r: AlertRule) => void
  onDeleted: (failed?: string) => void
}) {
  const start = initial ?? preset
  const [name, setName] = useState(start?.name ?? "")
  const [triggers, setTriggers] = useState<AlertTrigger[]>(start?.triggers ?? ["new_issue", "regression"])
  const [spike, setSpike] = useState(start?.spike ?? { events: 100, withinMinutes: 10 })
  const [logMatch, setLogMatch] = useState(start?.logMatch ?? LOG_MATCH)
  const [scope, setScope] = useState<"all" | "some">(start?.projectIds === undefined || start.projectIds === "all" ? "all" : "some")
  const [projectIds, setProjectIds] = useState<string[]>(Array.isArray(start?.projectIds) ? start.projectIds : [])
  const [envs, setEnvs] = useState<Environment[]>(start?.environments ?? ["production"])
  const [destIds, setDestIds] = useState<string[]>(start?.destinationIds ?? (destinations[0] ? [destinations[0].id] : []))
  const [enabled, setEnabled] = useState(start?.enabled ?? true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<Failure | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const input: AlertRuleInput = {
      id: initial?.id,
      name: name.trim() || triggers.map((t) => triggerLabel[t]).join(" + ") || "Untitled rule",
      projectIds: scope === "all" ? "all" : projectIds,
      environments: envs,
      triggers,
      spike: triggers.includes("spike") ? spike : null,
      logMatch: triggers.includes("log_match") ? { ...logMatch, query: logMatch.query.trim() } : null,
      destinationIds: destIds,
      enabled,
    }
    const r = await backend.saveAlertRule(input)
    setBusy(false)
    if (r.ok) {
      onSaved(r.value)
      onOpenChange(false)
    } else setError({ kind: r.failure, message: r.message })
  }

  const remove = async () => {
    if (!initial) return
    setBusy(true)
    const r = await backend.deleteAlertRule(initial.id)
    setBusy(false)
    onOpenChange(false)
    onDeleted(r.ok ? undefined : r.message)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg"
      title={initial ? "Edit alert rule" : "New alert rule"}
      description="When something happens in these projects, tell these destinations."
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Name" hint="Optional. Defaults to the triggers.">
          {(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Client sites down" />}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">When</span>
          <Checks
            label="Triggers"
            invalid={error?.kind === "no_trigger"}
            value={triggers}
            onChange={setTriggers}
            options={TRIGGERS.map((t) => ({ value: t, label: triggerLabel[t], hint: TRIGGER_HINT[t] }))}
          />
          {error?.kind === "no_trigger" && <InlineError className="mt-1">{error.message}</InlineError>}
          {triggers.includes("spike") && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Spike means more than
              <Input
                aria-label="Events"
                type="number"
                min={1}
                className="h-8 w-20 font-mono"
                value={spike.events}
                onChange={(e) => setSpike({ ...spike, events: Number(e.target.value) })}
              />
              events within
              <Input
                aria-label="Minutes"
                type="number"
                min={1}
                className="h-8 w-16 font-mono"
                value={spike.withinMinutes}
                onChange={(e) => setSpike({ ...spike, withinMinutes: Number(e.target.value) })}
              />
              minutes.
            </div>
          )}
          {triggers.includes("log_match") && (
            <div className="mt-1 flex flex-col gap-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                Log match means
                <Input
                  aria-label="Lines"
                  type="number"
                  min={1}
                  className="h-8 w-20 font-mono"
                  value={logMatch.count}
                  onChange={(e) => setLogMatch({ ...logMatch, count: Number(e.target.value) })}
                />
                or more lines within
                <Input
                  aria-label="Minutes"
                  type="number"
                  min={1}
                  className="h-8 w-16 font-mono"
                  value={logMatch.withinMinutes}
                  onChange={(e) => setLogMatch({ ...logMatch, withinMinutes: Number(e.target.value) })}
                />
                minutes,
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label="Minimum level" className="h-8 w-auto" value={logMatch.minLevel} onChange={(e) => setLogMatch({ ...logMatch, minLevel: e.target.value as LogLevel })}>
                  {LOG_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {logLevelAtLeast[l].toLowerCase()}
                    </option>
                  ))}
                </Select>
                matching
                <Input
                  aria-label="Log search"
                  className="h-8 min-w-0 flex-1 font-mono"
                  value={logMatch.query}
                  onChange={(e) => setLogMatch({ ...logMatch, query: e.target.value })}
                  placeholder='e.g. "fell back" service:api'
                />
              </div>
              <p className="text-faint">An empty search matches every line at the level.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">In</span>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Projects"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "All projects" },
                { value: "some", label: "Some" },
              ]}
            />
            <Checks label="Environments" value={envs} onChange={setEnvs} options={environments.map((e) => ({ value: e, label: envShort[e] }))} />
          </div>
          {scope === "some" && (
            <div className="mt-1 max-h-40 overflow-y-auto">
              <Checks
                label="Projects"
                value={projectIds}
                onChange={setProjectIds}
                options={projects.map((p) => ({ value: p.id, label: <span className="max-w-56 truncate">{p.name}</span> }))}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Tell</span>
          {destinations.length ? (
            <Checks
              label="Destinations"
              invalid={error?.kind === "no_destination"}
              value={destIds}
              onChange={setDestIds}
              options={destinations.map((d) => ({ value: d.id, label: destName(d) }))}
            />
          ) : (
            <p className="text-xs text-faint">No destinations yet. Add an email or webhook first.</p>
          )}
          {error?.kind === "no_destination" && <InlineError className="mt-1">{error.message}</InlineError>}
        </div>

        <label className="flex items-center justify-between gap-3 border-t border-hairline pt-4 text-sm text-muted-foreground">
          <span>
            Enabled <span className="text-xs text-faint">· a disabled rule keeps its settings and sends nothing</span>
          </span>
          <Switch label="Enabled" checked={enabled} onChange={setEnabled} />
        </label>

        {deleting ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-danger/25 px-3 py-2">
            <span className="mr-auto text-xs text-muted-foreground">Delete this rule? It stops sending at once.</span>
            <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setDeleting(false)}>
              Keep
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting…" : "Delete rule"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {initial && (
              <Button type="button" variant="ghost" className="mr-auto text-danger hover:text-danger" disabled={busy} onClick={() => setDeleting(true)}>
                <Trash2 /> Delete
              </Button>
            )}
            <Button type="button" variant="ghost" className={initial ? undefined : "ml-auto"} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save rule" : "Create rule"}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  )
}
