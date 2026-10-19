import { useState, type FormEvent } from "react"
import { cn } from "cn"
import { Check, ChevronRight, CircleAlert, CircleDot, KeyRound, MessageSquarePlus, Plus, RotateCcw, Trash2 } from "lucide-react"
import type { AccessToken, AgentReport } from "../contract/domain"
import type { AgentsPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Segmented } from "@/components/ui/form"
import { Mono, Square } from "@/components/ui/primitives"
import { Collapse } from "@/components/ui/motion"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { CopyButton, KeyField, Snippet } from "@/components/projects/Setup"
import { ago, date } from "@/lib/format"
import { Markdown } from "@/lib/markdown"
import { reportKindLabel, reportTone } from "@/lib/meaning"
import { Link } from "@/lib/router"
import { useShell } from "@/components/shell/ShellContext"

type Data = Ready<AgentsPage>
type Client = "claude" | "codex"

/** Matches the server's limit in `bertha-db`'s `TOKEN_NAME_LIMIT`. */
const NAME_LIMIT = 60

// User scope, so every app's checkout can reach it: that's where triage happens.
const claudeSetup = (url: string, secret: string) => `claude mcp add --transport http --scope user bertha ${url} \\
  --header "Authorization: Bearer ${secret}"`

const codexSetup = (url: string, secret: string) =>
  `# ~/.codex/config.toml
[mcp_servers.bertha]
url = "${url}"
bearer_token_env_var = "BERTHA_TOKEN"

# then, in the shell that runs codex
export BERTHA_TOKEN=${secret}`

/** How to connect, for whichever agent the token is for. */
function Setup({ mcpUrl, secret }: { mcpUrl: string; secret: string }) {
  const [client, setClient] = useState<Client>("claude")
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label="Agent"
        value={client}
        onChange={setClient}
        options={[
          { value: "claude", label: "Claude Code" },
          { value: "codex", label: "Codex" },
        ]}
      />
      {client === "claude" ? (
        <Snippet label="terminal" code={claudeSetup(mcpUrl, secret)} hide={secret} />
      ) : (
        <Snippet label="codex" code={codexSetup(mcpUrl, secret)} hide={secret} />
      )}
    </div>
  )
}

function CreateDialog({ open, onOpenChange, mcpUrl, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; mcpUrl: string; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ token: AccessToken; secret: string } | null>(null)
  const [shown, setShown] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await backend.createAccessToken(name.trim())
    setBusy(false)
    if (r.ok) {
      setCreated(r.value)
      onCreated()
    } else setError(r.message)
  }
  if (created)
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        className="max-w-xl"
        title={`Connect ${created.token.name}`}
        description="This is the only time bertha shows the token. Copy it now; bertha keeps only a hash."
      >
        <div className="flex flex-col gap-5">
          <KeyField label="Access token" value={created.secret} fresh shown={shown} onShownChange={setShown} />
          <Setup mcpUrl={mcpUrl} secret={created.secret} />
          <p className="text-xs text-faint">
            Then ask the agent to triage an issue by its link. It reads the issue, writes notes and resolves it as you, shown as{" "}
            <span className="text-muted-foreground">via {created.token.name}</span>.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </Dialog>
    )
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New token" description="The agent acts as you and sees only the projects you see. It can triage issues but can't change settings.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Name" hint="Name it after the agent or machine. It shows on everything the agent writes." error={error ?? undefined}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              aria-invalid={!!error}
              autoFocus
              maxLength={NAME_LIMIT}
              placeholder="claude on laptop"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create token"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function TokenRow({ t, onRevoked }: { t: AccessToken; onRevoked: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const revoke = async () => {
    setBusy(true)
    const r = await backend.revokeAccessToken(t.id)
    setBusy(false)
    setConfirming(false)
    if (r.ok) onRevoked()
    else setError(`${r.message} Refresh to see the current list.`)
  }
  return (
    <li className="border-b border-hairline px-4 py-3.5 last:border-b-0 md:px-5">
      <div className="flex items-center gap-3">
        <KeyRound className="size-4 shrink-0 text-faint" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-6">
          <span className="truncate text-sm text-foreground" title={t.name}>
            {t.name}
          </span>
          <Mono className="truncate text-xs text-faint">
            created {date(t.createdAt)} · {t.lastUsedAt ? `last used ${ago(t.lastUsedAt)}` : "never used"}
          </Mono>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className={cn("text-muted-foreground", confirming && "bg-raised text-foreground")}
          aria-label={`Revoke ${t.name}`}
          aria-expanded={confirming}
          onClick={() => (setError(null), setConfirming(!confirming))}
        >
          <Trash2 />
        </Button>
      </div>
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-md border border-hairline bg-sidebar/60 px-3 py-2 md:ml-7">
          <span className="mr-auto text-xs text-muted-foreground">Revoke {t.name}? The agent using it is refused from its next request.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void revoke()}>
            {busy ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      )}
      {error && (
        <div className="mt-3 md:pl-7">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </li>
  )
}

type Show = "open" | "all"

function ReportRow({ r, owner, onChanged }: { r: AgentReport; owner: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = r.kind === "problem" ? CircleAlert : MessageSquarePlus
  const toggle = async () => {
    setBusy(true)
    setError(null)
    const res = await backend.setAgentReportDone(r.id, !r.done)
    setBusy(false)
    if (res.ok) onChanged()
    else setError(res.failure === "not_found" ? `${res.message} Refresh to see the current list.` : res.message)
  }
  const detailsId = `report-${r.id}`
  return (
    <li className="border-b border-hairline last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-3.5 md:px-5">
        <Icon className="mt-0.5 size-4 shrink-0 text-faint" aria-label={reportKindLabel[r.kind]} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            className="group flex min-w-0 items-start gap-1 text-left text-sm text-foreground"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen(!open)}
          >
            <span className={cn("min-w-0 break-words", r.done && "text-muted-foreground")}>{r.summary}</span>
            <ChevronRight
              aria-hidden
              className={cn("mt-0.5 size-4 shrink-0 text-faint transition-transform duration-200 ease-smooth group-hover:text-muted-foreground", open && "rotate-90")}
            />
          </button>
          <div className="flex flex-wrap items-center gap-y-0.5 text-xs text-faint">
            {[
              <span key="kind">{reportKindLabel[r.kind]}</span>,
              r.issue && (
                <Link key="issue" to={`/issues/${r.issue.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <CircleDot aria-hidden className="size-3" />
                  <Mono>{r.issue.shortId}</Mono>
                </Link>
              ),
              r.tool && <Mono key="tool">{r.tool}</Mono>,
              <span key="by">
                {r.by.name} via {r.via}
              </span>,
              <Mono key="at" title={date(r.at)}>
                {ago(r.at)}
              </Mono>,
            ]
              .filter(Boolean)
              .map((item, i) => (
                // The dot travels with the item after it, so none is left at a line's end.
                <span key={i} className="inline-flex items-center whitespace-nowrap">
                  {i > 0 && (
                    <span aria-hidden className="px-1.5">
                      ·
                    </span>
                  )}
                  {item}
                </span>
              ))}
          </div>
        </div>
        {r.done && (
          <span className="mt-0.5 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Square tone={reportTone.done} />
            Done
          </span>
        )}
        {owner && (
          <Button size="sm" variant="ghost" className="-my-1 shrink-0 text-muted-foreground" disabled={busy} onClick={() => void toggle()}>
            {r.done ? <RotateCcw /> : <Check />}
            <span className="max-md:sr-only">{r.done ? "Reopen" : "Mark done"}</span>
          </Button>
        )}
      </div>
      <Collapse open={open}>
        <div id={detailsId} className="flex flex-col gap-2 px-4 pb-4 pl-11 text-sm text-muted-foreground md:px-5 md:pl-12">
          {r.details ? <Markdown source={r.details} repoUrl={null} /> : <p className="text-faint">No details. The summary is all the agent sent.</p>}
          <Mono className="text-xs text-faint">bertha {r.version} · {date(r.at)}</Mono>
        </div>
      </Collapse>
      {error && (
        <div className="px-4 pb-3 md:px-5 md:pl-12">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </li>
  )
}

/** What agents told the owner about bertha: problems it caused them, and what they wished it did. */
function Reports({ reports, owner, onChanged }: { reports: AgentReport[]; owner: boolean; onChanged: () => void }) {
  const open = reports.filter((r) => !r.done)
  const [show, setShow] = useState<Show>(open.length || !reports.length ? "open" : "all")
  const shown = show === "open" ? open : reports
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium text-foreground">Reports from agents</h2>
          <span className="text-xs text-faint">
            {owner ? "When bertha gets in an agent's way, it tells you here." : "What your agents told the owner about bertha. The owner marks them done."}
          </span>
        </div>
        {reports.length > 0 && (
          <Segmented
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: "open", label: `Open ${open.length}` },
              { value: "all", label: `All ${reports.length}` },
            ]}
          />
        )}
      </div>
      {shown.length ? (
        <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
          {shown.map((r) => (
            <ReportRow key={r.id} r={r} owner={owner} onChanged={onChanged} />
          ))}
        </ul>
      ) : reports.length ? (
        <EmptyState className="rounded-lg border border-dashed border-border px-4 py-6" title="Nothing open." cells="void">
          Every report is marked done.
        </EmptyState>
      ) : (
        <EmptyState className="rounded-lg border border-dashed border-border px-4 py-6" title="No reports yet." cells="void">
          Agents report here when a bertha tool fails, misleads them or leaves out data they needed, and when they want something bertha doesn't do.
        </EmptyState>
      )}
    </section>
  )
}

export function Agents() {
  const page = usePageLoadable<Data>("/settings/agents", () => backend.getAgents(), [])
  const { state } = page
  const [creating, setCreating] = useState(false)
  const owner = useShell().viewer.role === "owner"
  const crumbs = [{ label: "Agents" }]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex max-w-5xl flex-col gap-3 p-4 md:p-6" aria-busy>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-20" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
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

  // Empty still knows where agents connect; the fixtures and the server both send it.
  const data: Data = state.status === "ready" ? state.data : { tokens: [], reports: [], mcpUrl: `${window.location.origin}/mcp` }
  const create = (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus /> New token
    </Button>
  )

  return (
    <>
      <TopBar crumbs={crumbs}>{data.tokens.length > 0 && create}</TopBar>
      <div className="flex max-w-5xl flex-col gap-10 px-4 py-6 md:px-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground">How agents connect</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Claude Code, Codex and other agents reach bertha through MCP with a token. Ask one to triage an issue by its link: it reads the stack, writes a note and resolves
            the issue once it's fixed.
          </p>
          <div className="flex max-w-2xl items-center gap-1 rounded-md border border-hairline bg-sidebar py-1 pr-1 pl-3">
            <span className="shrink-0 text-xs text-faint">MCP</span>
            <Mono className="min-w-0 flex-1 truncate pl-2 text-sm text-foreground">{data.mcpUrl}</Mono>
            <CopyButton text={data.mcpUrl} />
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium text-foreground">Your tokens</h2>
            <span className="text-xs text-faint">Each acts as you. Only you see your tokens.</span>
          </div>
          {data.tokens.length ? (
            <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
              {data.tokens.map((t) => (
                <TokenRow
                  key={t.id}
                  t={t}
                  onRevoked={() => {
                    toast({
                      tone: "quiet",
                      body: (
                        <>
                          Revoked <span className="text-foreground">{t.name}</span>. It no longer works.
                        </>
                      ),
                    })
                    page.reload()
                  }}
                />
              ))}
            </ul>
          ) : (
            <EmptyState className="rounded-lg border border-dashed border-border px-4 py-6" title="No tokens. Agents can't reach bertha yet." action={create}>
              Make one for each agent or machine, so you can revoke one without the others.
            </EmptyState>
          )}
        </section>
        <Reports reports={data.reports} owner={owner} onChanged={page.reload} />
      </div>
      <CreateDialog key={String(creating)} open={creating} onOpenChange={setCreating} mcpUrl={data.mcpUrl} onCreated={page.reload} />
    </>
  )
}
