import { useState, type FormEvent } from "react"
import { cn } from "cn"
import { Plus, UserMinus } from "lucide-react"
import type { Member, Project } from "../../packet/contract/domain"
import type { TeamPage } from "../../packet/contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { Button } from "@/components/ui/button"
import { Checks, Dialog, Field, Input } from "@/components/ui/form"
import { Avatar, Mono } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { date, plural } from "@/lib/format"

type Data = Ready<TeamPage>

const projectOptions = (projects: Project[]) =>
  projects.map((p) => ({ value: p.id, label: <span className="max-w-56 truncate">{p.name}</span>, hint: p.name }))

function InviteDialog({ open, onOpenChange, data, onInvited }: { open: boolean; onOpenChange: (o: boolean) => void; data: Data; onInvited: (m: Member) => void }) {
  const [email, setEmail] = useState("")
  const [projectIds, setProjectIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "already_member" | "invalid_email"; message: string } | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await backend.inviteMember({ email: email.trim(), projectIds })
    setBusy(false)
    if (r.ok) {
      onInvited(r.value)
      onOpenChange(false)
    } else setError({ kind: r.failure, message: r.message })
  }
  const existing = data.members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase())
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Invite a collaborator" description="They get an email link. Once they accept, they see only the projects you pick here.">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Email"
          error={
            error?.kind === "invalid_email" ? (
              <>
                {error.message} <span className="text-muted-foreground">It needs a domain, like name@example.com.</span>
              </>
            ) : error?.kind === "already_member" ? (
              <>
                {error.message} <span className="text-muted-foreground">{existing && existing.name !== existing.email ? `${existing.name} is on the team. ` : ""}Change their access from the list instead.</span>
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
              type="text"
              inputMode="email"
              className="font-mono"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Projects they can see</span>
          <Checks label="Projects they can see" value={projectIds} onChange={setProjectIds} options={projectOptions(data.projects)} />
          <p className="text-xs text-faint">They can triage issues in these projects. Alerts and team settings stay yours.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !email.trim() || !projectIds.length}>
            {busy ? "Sending…" : "Send invitation"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function AccessDialog({ member, projects, onClose, onSaved }: { member: Member; projects: Project[]; onClose: () => void; onSaved: (m: Member) => void }) {
  const [projectIds, setProjectIds] = useState<string[]>(member.projectIds === "all" ? projects.map((p) => p.id) : member.projectIds)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setBusy(true)
    const r = await backend.updateMemberAccess(member.id, projectIds)
    setBusy(false)
    if (r.ok) onSaved(r.value)
    else setError(r.message)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Access for ${member.name}`} description="Projects they can see and triage. Removing one takes effect on their next page load.">
      <div className="flex flex-col gap-5">
        <Checks label="Projects" value={projectIds} onChange={setProjectIds} options={projectOptions(projects)} invalid={!projectIds.length} />
        {!projectIds.length && <p className="-mt-3 text-xs text-faint">With no projects they'd see nothing. Remove them instead.</p>}
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5">
            <InlineError>{error}</InlineError>
            <p className="mt-1 pl-4 text-xs text-muted-foreground">Only the owner can change access. Nothing was changed.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !projectIds.length} onClick={() => void save()}>
            {busy ? "Saving…" : "Save access"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function MemberRow({ m, data, you, owner, onEdit, onRemoved }: { m: Member; data: Data; you: boolean; owner: boolean; onEdit: () => void; onRemoved: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = m.joinedAt === null
  const names = m.projectIds === "all" ? null : m.projectIds.map((id) => data.projects.find((p) => p.id === id)?.name).filter(Boolean)
  const remove = async () => {
    setBusy(true)
    const r = await backend.removeMember(m.id)
    setBusy(false)
    setConfirming(false)
    if (r.ok) onRemoved()
    else setError(r.message)
  }
  return (
    <li className="border-b border-hairline px-4 py-4 last:border-b-0 md:px-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)_112px] md:items-center md:gap-x-6">
        <Avatar name={m.name} className={cn("size-8 text-xs", pending && "border-dashed bg-transparent")} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2 text-sm">
            <span className={cn("truncate", pending ? "font-mono text-muted-foreground" : "text-foreground")} title={m.name}>
              {m.name}
            </span>
            {you && <span className="shrink-0 text-faint">you</span>}
          </div>
          <Mono className="block truncate text-xs text-faint">
            {pending ? "invited · hasn't accepted yet" : m.name !== m.email ? m.email : `joined ${date(m.joinedAt!)}`}
          </Mono>
        </div>
        <div className="col-start-2 min-w-0 text-sm md:col-start-auto">
          {m.role === "owner" ? (
            <span className="text-muted-foreground">
              Owner <span className="text-faint">· every project, alerts and team</span>
            </span>
          ) : (
            <span className="block truncate text-muted-foreground" title={names?.join(", ")}>
              <Mono className="mr-2 text-xs text-faint">{plural(names?.length ?? 0, "project")}</Mono>
              {names?.join(", ")}
            </span>
          )}
        </div>
        {owner && (
          <div className="col-start-2 flex items-center gap-1 md:col-start-auto md:justify-end">
            {/* The owner can't be removed, so their row has nothing to change. */}
            {m.role !== "owner" && (
              <>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Access
                </Button>
                <Button size="sm" variant="ghost" className={cn("text-muted-foreground", confirming && "bg-raised text-foreground")} aria-label={`Remove ${m.name}`} aria-expanded={confirming} onClick={() => (setError(null), setConfirming(!confirming))}>
                  <UserMinus />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-md border border-hairline bg-sidebar/60 px-3 py-2 md:ml-14">
          <span className="mr-auto text-xs text-muted-foreground">{pending ? "Cancel the invitation? The link stops working." : `Remove ${m.name}? They lose access to every project at once.`}</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove()}>
            {busy ? "Removing…" : pending ? "Cancel invite" : "Remove"}
          </Button>
        </div>
      )}
      {error && (
        <div className="mt-3 md:pl-14">
          <InlineError>{error}</InlineError>
        </div>
      )}
    </li>
  )
}

export function Team() {
  const shell = useShell()
  const owner = isOwner(shell)
  const page = usePageLoadable<Data>("/settings/team", () => backend.getTeam(), [])
  const { state } = page
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const crumbs = [{ label: "Settings" }, { label: "Team" }]

  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex max-w-5xl flex-col gap-3 p-4 md:p-6" aria-busy>
          <Skeleton className="h-5 w-48" />
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

  const data: Data = state.status === "ready" ? state.data : { members: [], projects: [] }
  const joined = data.members.filter((m) => m.joinedAt !== null)
  const pending = data.members.filter((m) => m.joinedAt === null)
  const row = (m: Member) => (
    <MemberRow
      key={m.id}
      m={m}
      data={data}
      you={m.id === shell.viewer.id}
      owner={owner}
      onEdit={() => setEditing(m)}
      onRemoved={() => {
        toast({ tone: "quiet", body: m.joinedAt === null ? <>Invitation to <span className="text-foreground">{m.email}</span> cancelled.</> : <>Removed <span className="text-foreground">{m.name}</span>. They've lost access to everything.</> })
        page.reload()
      }}
    />
  )

  return (
    <>
      <TopBar crumbs={crumbs}>
        {owner && (
          <Button size="sm" onClick={() => setInviting(true)}>
            <Plus /> Invite
          </Button>
        )}
      </TopBar>
      <div className="flex max-w-5xl flex-col gap-10 px-4 py-6 md:px-6">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium text-foreground">People</h2>
            <span className="text-xs text-faint">{owner ? "Collaborators see only the projects they're given." : "Only the owner can change who sees what."}</span>
          </div>
          <ul className="overflow-hidden rounded-lg border border-hairline bg-card">{joined.map(row)}</ul>
        </section>
        {pending.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium text-foreground">Waiting to accept</h2>
              <span className="text-xs text-faint">Invitations last 7 days.</span>
            </div>
            <ul className="overflow-hidden rounded-lg border border-dashed border-border">{pending.map(row)}</ul>
          </section>
        )}
        {owner && joined.length === 1 && !pending.length && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-4">
            <span className="text-sm text-faint">Just you. Invite a client or a friend to help triage one project.</span>
            <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
              <Plus /> Invite
            </Button>
          </div>
        )}
      </div>
      <InviteDialog
        key={String(inviting)}
        open={inviting}
        onOpenChange={setInviting}
        data={data}
        onInvited={(m) => {
          toast({ tone: "quiet", body: <>Invitation sent to <span className="font-mono text-foreground">{m.email}</span>.</> })
          page.reload()
        }}
      />
      {editing && (
        <AccessDialog
          member={editing}
          projects={data.projects}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null)
            toast({ tone: "quiet", body: <>Updated access for <span className="text-foreground">{m.name}</span>.</> })
            page.reload()
          }}
        />
      )}
    </>
  )
}
