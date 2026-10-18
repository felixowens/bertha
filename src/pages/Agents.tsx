import { useState, type FormEvent } from "react"
import { cn } from "cn"
import { KeyRound, Plus, Trash2 } from "lucide-react"
import type { AccessToken } from "../contract/domain"
import type { AgentsPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Segmented } from "@/components/ui/form"
import { Mono } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { CopyButton, KeyField, Snippet } from "@/components/projects/Setup"
import { ago, date } from "@/lib/format"

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

export function Agents() {
  const page = usePageLoadable<Data>("/settings/agents", () => backend.getAgents(), [])
  const { state } = page
  const [creating, setCreating] = useState(false)
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
  const data: Data = state.status === "ready" ? state.data : { tokens: [], mcpUrl: `${window.location.origin}/mcp` }
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
      </div>
      <CreateDialog key={String(creating)} open={creating} onOpenChange={setCreating} mcpUrl={data.mcpUrl} onCreated={page.reload} />
    </>
  )
}
