import { useState } from "react"
import { cn } from "cn"
import { Mail, Plus, Send, Webhook } from "lucide-react"
import type { AlertDestination, AlertRule } from "../contract/domain"
import type { AlertsPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { RuleForm } from "@/components/alerts/RuleForm"
import { DestinationForm } from "@/components/alerts/DestinationForm"
import { destName } from "@/components/alerts/meaning"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/form"
import { Mono, Square } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { ago, plural, time } from "@/lib/format"
import { envShort, triggerLabel } from "@/lib/meaning"

type Data = Ready<AlertsPage>

const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" or ") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`)

function RuleRow({ rule, data, onEdit, onToggle }: { rule: AlertRule; data: Data; onEdit: () => void; onToggle: (on: boolean) => void }) {
  const where =
    rule.projectIds === "all"
      ? "all projects"
      : rule.projectIds.length === 1
        ? (data.projects.find((p) => p.id === rule.projectIds[0])?.name ?? "1 project")
        : plural(rule.projectIds.length, "project")
  const to = rule.destinationIds.map((id) => data.destinations.find((d) => d.id === id)).filter((d): d is AlertDestination => !!d)
  return (
    <li className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 border-b border-hairline px-4 py-4 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-5", !rule.enabled && "bg-sidebar/40")}>
      <div className="pt-0.5">
        <Switch label={`${rule.name} enabled`} checked={rule.enabled} onChange={onToggle} />
      </div>
      <button onClick={onEdit} className="group min-w-0 text-left">
        <div className={cn("truncate text-sm group-hover:underline group-hover:decoration-border group-hover:underline-offset-4", rule.enabled ? "text-foreground" : "text-muted-foreground")}>{rule.name}</div>
        <p className="mt-1 text-sm text-faint">
          <span className="text-muted-foreground">{list(rule.triggers.map((t) => triggerLabel[t]))}</span>
          {rule.spike && (
            <Mono className="text-xs">
              {" "}
              (&gt;{rule.spike.events} in {rule.spike.withinMinutes}m)
            </Mono>
          )}{" "}
          in <span className="text-muted-foreground">{where}</span> · {rule.environments.map((e) => envShort[e]).join(", ")} <span aria-hidden>→</span>
          <span className="sr-only">tell</span> <span className="text-muted-foreground">{to.length ? to.map(destName).join(", ") : "nobody"}</span>
        </p>
      </button>
      <Mono className="col-start-2 text-xs text-faint md:col-start-auto md:pt-0.5 md:text-right">{!rule.enabled ? "off" : rule.lastFiredAt ? `fired ${ago(rule.lastFiredAt)}` : "never fired"}</Mono>
    </li>
  )
}

function DestinationRow({ d, uses }: { d: AlertDestination; uses: number }) {
  const [state, setState] = useState<{ s: "idle" | "sending" } | { s: "ok"; at: string } | { s: "failed"; message: string }>({ s: "idle" })
  const test = async () => {
    setState({ s: "sending" })
    const r = await backend.testDestination(d.id)
    setState(r.ok ? { s: "ok", at: r.value.deliveredAt } : { s: "failed", message: r.message })
  }
  const Icon = d.kind === "email" ? Mail : Webhook
  return (
    <li className="border-b border-hairline px-4 py-3.5 last:border-b-0 md:px-5">
      <div className="flex items-center gap-3">
        <Icon className="size-4 shrink-0 text-faint" strokeWidth={1.5} aria-label={d.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm text-foreground">{destName(d)}</span>
            <span className="shrink-0 text-xs text-faint">{uses ? plural(uses, "rule") : "unused"}</span>
          </div>
          <Mono className="block truncate text-xs text-faint" title={d.kind === "webhook" ? d.url : undefined}>
            {d.kind === "webhook" ? d.url.replace(/^https:\/\//, "") : "email"}
          </Mono>
        </div>
        <Button variant="outline" size="sm" disabled={state.s === "sending"} onClick={() => void test()}>
          <Send /> {state.s === "sending" ? "Sending…" : state.s === "failed" ? "Try again" : "Send test"}
        </Button>
      </div>
      {state.s === "ok" && (
        <p className="mt-2 flex items-center gap-2 pl-7 text-xs text-muted-foreground" role="status">
          <Square tone="quiet" /> Test delivered at <Mono>{time(state.at)}</Mono>. {d.kind === "email" ? "Check the inbox (and spam)." : "Check it arrived."}
        </p>
      )}
      {state.s === "failed" && (
        <div className="mt-2 pl-7">
          <InlineError>{state.message}</InlineError>
          <p className="mt-1 pl-4 text-xs text-faint">
            {d.kind === "webhook" ? "The hook may have been deleted or rotated on the other side. Replace the URL with a fresh one." : "The address may be wrong or the mailbox full."} Rules using it will fail the same way.
          </p>
        </div>
      )}
    </li>
  )
}

export function Alerts() {
  const page = usePageLoadable<Data>("/settings/alerts", () => backend.getAlerts(), [])
  const { state } = page
  const [editing, setEditing] = useState<AlertRule | "new" | null>(null)
  const [addingDest, setAddingDest] = useState(false)
  const crumbs = [{ label: "Settings" }, { label: "Alerts" }]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex flex-col gap-3 p-4 md:p-6" aria-busy>
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </>
    )
  if (state.status === "error")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <ErrorState className="p-6 md:p-10" message={state.message} onRetry={page.reload} />
      </>
    )

  const data: Data = state.status === "ready" ? state.data : { rules: [], destinations: [], projects: [], environments: ["production", "staging", "development"] }
  const empty = !data.rules.length && !data.destinations.length

  const toggle = async (rule: AlertRule, enabled: boolean) => {
    page.set((d) => ({ ...d, rules: d.rules.map((r) => (r.id === rule.id ? { ...r, enabled } : r)) }))
    const { id, lastFiredAt: _, ...rest } = rule
    const r = await backend.saveAlertRule({ ...rest, id, enabled })
    if (!r.ok) {
      page.set((d) => ({ ...d, rules: d.rules.map((x) => (x.id === rule.id ? rule : x)) }))
      toast({ tone: "danger", body: r.message })
    }
  }

  return (
    <>
      <TopBar crumbs={crumbs}>
        {!empty && (
          <Button size="sm" onClick={() => setEditing("new")} disabled={!data.destinations.length}>
            <Plus /> New rule
          </Button>
        )}
      </TopBar>
      {empty ? (
        <EmptyState
          className="p-6 md:p-10"
          title="No alerts yet."
          action={
            <Button size="sm" onClick={() => setAddingDest(true)}>
              <Plus /> Add a destination
            </Button>
          }
        >
          bertha won't tell you about anything until there's somewhere to send it. Add an email or a webhook, then a rule saying when to use it.
        </EmptyState>
      ) : (
        <div className="grid gap-10 px-4 py-6 md:px-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-foreground">Rules</h2>
              <span className="text-xs text-faint">{data.rules.filter((r) => r.enabled).length} of {data.rules.length} on</span>
            </div>
            {data.rules.length ? (
              <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
                {data.rules.map((r) => (
                  <RuleRow key={r.id} rule={r} data={data} onEdit={() => setEditing(r)} onToggle={(on) => void toggle(r, on)} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-4">
                <span className="text-sm text-faint">No rules. Destinations are set up but nothing sends to them.</span>
                <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
                  <Plus /> New rule
                </Button>
              </div>
            )}
          </section>
          <section className="min-w-0">
            <div className="mb-3 flex h-8 items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-foreground">Destinations</h2>
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" onClick={() => setAddingDest(true)}>
                <Plus /> Add
              </Button>
            </div>
            <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
              {data.destinations.map((d) => (
                <DestinationRow key={d.id} d={d} uses={data.rules.filter((r) => r.destinationIds.includes(d.id)).length} />
              ))}
            </ul>
          </section>
        </div>
      )}
      <RuleForm
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing && editing !== "new" ? editing : undefined}
        projects={data.projects}
        environments={data.environments}
        destinations={data.destinations}
        onSaved={(r) => {
          toast({ tone: "quiet", body: <>Saved <span className="text-foreground">{r.name}</span>.</> })
          page.reload()
        }}
        onDeleted={(failed) => {
          toast(failed ? { tone: "warn", body: <>{failed} The list has been refreshed.</> } : { tone: "quiet", body: "Rule deleted." })
          page.reload()
        }}
      />
      <DestinationForm
        key={String(addingDest)}
        open={addingDest}
        onOpenChange={setAddingDest}
        onSaved={(d) => {
          toast({ tone: "quiet", body: <>Added <span className="text-foreground">{destName(d)}</span>. Send it a test.</> })
          page.reload()
        }}
      />
    </>
  )
}
