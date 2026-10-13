import { useEffect, useState } from "react"
import { cn } from "cn"
import { ExternalLink, KeyRound, Plus, Trash2 } from "lucide-react"
import type { ProjectSetup } from "../../packet/contract/domain"
import type { ProjectSettingsPage } from "../../packet/contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { FirstEvent, KeyField, Snippet } from "@/components/projects/Setup"
import { MonitorForm } from "@/components/uptime/MonitorForm"
import { Ribbon } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input } from "@/components/ui/form"
import { Avatar, Mono, Square, toneText } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { ago, plural } from "@/lib/format"
import { envShort, healthLabel, healthTone, monitorLabel, monitorTone, runtimeLabel } from "@/lib/meaning"
import { Link, navigate } from "@/lib/router"

type Data = Ready<ProjectSettingsPage>

/** One settings block: what it is on the left, the controls on the right. */
function Block({ id, title, children, intro, danger }: { id?: string; title: string; intro?: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-x-10 gap-y-4 border-b border-hairline px-4 py-8 last:border-b-0 md:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className={cn("text-sm font-medium", danger ? "text-danger" : "text-foreground")}>{title}</h2>
        {intro && <div className="mt-1.5 text-sm text-faint">{intro}</div>}
      </div>
      <div className="flex min-w-0 max-w-2xl flex-col gap-4">{children}</div>
    </section>
  )
}

function Connection({ data, onRotated }: { data: Data; onRotated: (s: ProjectSetup) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState(false)
  const [shown, setShown] = useState(false)
  const rotate = async () => {
    setBusy(true)
    setError(null)
    const r = await backend.rotateIngestKey(data.project.id)
    setBusy(false)
    setConfirm(false)
    if (r.ok) {
      setFresh(true)
      setShown(true)
      onRotated(r.value)
      toast({ tone: "warn", body: "New key issued. The old one stopped working just now." })
    } else setError(r.failure === "permission_denied" ? `${r.message} Ask the owner to rotate it.` : r.message)
  }
  return (
    <Block title="Connection" intro="The key your app's error client sends with every event. The snippet sets it up and tags each deploy.">
      <FirstEvent setup={data.setup} lastEventAt={data.project.lastEventAt} />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-xs text-muted-foreground">Connection key</span>
          {fresh && <span className="text-xs text-warn">Redeploy every app that uses this project.</span>}
        </div>
        <KeyField key={data.setup.ingestKey} value={data.setup.ingestKey} fresh={fresh} shown={shown} onShownChange={setShown} />
        {error && <InlineError className="mt-1">{error}</InlineError>}
      </div>
      <Snippet code={data.setup.snippet} hide={shown ? undefined : data.setup.ingestKey} />
      <div>
        <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
          <KeyRound /> Rotate key
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Rotate the connection key?" description="The current key stops working the moment you confirm. Events from apps still using it are dropped until they're redeployed with the new one.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Keep current key
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void rotate()}>
            {busy ? "Rotating…" : "Rotate now"}
          </Button>
        </div>
      </Dialog>
    </Block>
  )
}

function SourceMaps({ setup, projectKey }: { setup: ProjectSetup; projectKey: string }) {
  const sm = setup.sourceMaps
  const cmd = setup.snippet.split("\n").find((l) => l.includes("--sourcemaps")) ?? `npx bertha-cli release --project ${projectKey.toLowerCase()} --sourcemaps ./build`
  return (
    <Block id="source-maps" title="Source maps" intro="With them, stack traces show your original files and line numbers instead of minified chunks.">
      {sm.latestRelease === null ? (
        <p className="flex items-center gap-2 text-sm text-faint">
          <Square tone="void" hollow /> No releases yet. Upload maps with your first deploy.
        </p>
      ) : sm.uploaded ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Square tone="quiet" /> Uploaded for <Mono className="text-foreground">{sm.latestRelease}</Mono>, the latest release.
        </p>
      ) : (
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
            <Square tone="warn" /> Missing for <Mono>{sm.latestRelease}</Mono>, the latest release.
          </p>
          <p className="mt-1 pl-4 text-sm text-muted-foreground">Its stack traces show minified code. Add this to the build step, after the build:</p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-hairline bg-sidebar p-3 font-mono text-xs text-foreground">{cmd}</pre>
        </div>
      )}
    </Block>
  )
}

function Uptime({ data, onChange }: { data: Data; onChange: () => void }) {
  const shell = useShell()
  const [adding, setAdding] = useState(false)
  const m = data.monitor
  return (
    <Block title="Uptime" intro="One URL checked on a schedule. When it stops answering, its project shows as down.">
      {m ? (
        <Link to={`/uptime/${m.id}`} className="group flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4 transition-colors hover:border-border">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Square tone={monitorTone[m.state]} hollow={m.state === "paused"} />
              {m.name}
            </span>
            <Mono className={cn("text-xs", m.state === "up" ? "text-faint" : toneText[monitorTone[m.state]])}>
              {monitorLabel[m.state].toLowerCase()} · {m.uptime30d.toFixed(2)}% · every {m.intervalSeconds / 60}m
            </Mono>
          </div>
          <Mono className="truncate text-xs text-faint">{m.url}</Mono>
          <Ribbon states={m.recent.map((s) => (s ? monitorTone[s] : "void"))} cellClass="h-4 w-[5px]" label={`Last ${m.recent.length} checks`} />
        </Link>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
          <span className="text-sm text-faint">No monitor. bertha won't notice if {data.project.url ? <Mono>{data.project.url.replace(/^https?:\/\//, "")}</Mono> : "the site"} goes down.</span>
          {isOwner(shell) && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add monitor
            </Button>
          )}
        </div>
      )}
      {isOwner(shell) && !m && (
        <MonitorForm key={String(adding)} open={adding} onOpenChange={setAdding} projects={[data.project]} onSaved={() => { toast({ tone: "quiet", body: "Monitor added." }); onChange() }} />
      )}
    </Block>
  )
}

function Members({ data }: { data: Data }) {
  const shell = useShell()
  return (
    <Block title="Who can see it" intro={isOwner(shell) ? <>Collaborators see only the projects they're given. <Link to="/settings/team" className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">Manage on Team</Link></> : "Collaborators see only the projects they're given."}>
      <ul className="overflow-hidden rounded-lg border border-hairline">
        {data.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0">
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground">
                {m.name}
                {m.id === shell.viewer.id && <span className="text-faint"> (you)</span>}
              </div>
              {m.name !== m.email && <Mono className="block truncate text-xs text-faint">{m.email}</Mono>}
            </div>
            <Mono className="shrink-0 text-xs text-faint">{m.joinedAt === null ? "invited" : m.role === "owner" ? "owner · all projects" : plural(m.projectIds === "all" ? 0 : m.projectIds.length, "project")}</Mono>
          </li>
        ))}
      </ul>
    </Block>
  )
}

function Delete({ data }: { data: Data }) {
  const shell = useShell()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: string; message: string } | null>(null)
  const p = data.project
  useEffect(() => {
    if (!open) {
      setTyped("")
      setError(null)
    }
  }, [open])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.deleteProject(p.id, typed)
    setBusy(false)
    if (r.ok) {
      setOpen(false)
      toast({ tone: "quiet", body: <>Deleted <span className="text-foreground">{p.name}</span> and its events.</> })
      shell.reload()
      navigate("/")
    } else setError({ kind: r.failure, message: r.message })
  }
  return (
    <Block danger title="Delete project" intro="Removes its issues, events, releases and monitor. There's no undo.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/25 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {p.unresolvedIssues ? `${plural(p.unresolvedIssues, "unresolved issue")} and every event go with it.` : "Every issue and event goes with it."}
        </span>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 /> Delete…
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={`Delete ${p.name}?`} description="Its issues, events, releases and monitor are removed for everyone. Apps still sending to it will get errors back.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label={`Type the project name to confirm`}
            hint={<>Exactly: <Mono className="text-foreground">{p.name}</Mono></>}
            error={error?.kind === "name_mismatch" ? <>That doesn't match. Type <Mono className="text-foreground">{p.name}</Mono> exactly; capitals count.</> : undefined}
          >
            {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={error?.kind === "name_mismatch"} autoFocus autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />}
          </Field>
          {error?.kind === "permission_denied" && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3">
              <InlineError>{error.message}</InlineError>
              <p className="mt-1 pl-4 text-xs text-muted-foreground">Only the owner can delete projects. Nothing was removed.</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !typed.trim()}>
              {busy ? "Deleting…" : "Delete project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Block>
  )
}

export function ProjectSettings({ projectId }: { projectId: string }) {
  const page = usePageLoadable<Data>("/projects/:projectId/settings", () => backend.getProjectSettings(projectId), [projectId])
  const { state } = page

  // Arriving at #source-maps from a stack trace: scroll once the block exists.
  useEffect(() => {
    if (state.status === "ready" && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [state.status])

  const crumbs = [{ label: state.status === "ready" ? state.data.project.name : "Project" }, { label: "Settings" }]
  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        <div className="flex flex-col gap-4 p-4 md:p-6" aria-busy>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="mt-6 h-40" />
          <Skeleton className="h-24" />
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
  if (state.status === "empty")
    return (
      <>
        <TopBar crumbs={[{ label: "Project not found" }]} />
        <EmptyState className="p-6 md:p-10" cells="void" title="No such project." action={<Button variant="outline" size="sm" asChild><Link to="/">Overview</Link></Button>}>
          It was deleted, or you don't have access to it.
        </EmptyState>
      </>
    )

  const data = state.data
  const p = data.project
  return (
    <>
      <TopBar crumbs={crumbs}>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/issues?project=${p.id}`}>Issues</Link>
        </Button>
      </TopBar>
      <header className="border-b border-hairline px-4 pt-6 pb-7 md:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <Mono className="rounded-[4px] border border-hairline px-1.5 py-0.5 text-muted-foreground">{p.key}</Mono>
          {p.client && <span>for {p.client}</span>}
          {p.url && (
            <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono hover:text-foreground">
              {p.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <h1 className="text-xl text-foreground md:text-2xl">{p.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className={cn("flex items-center gap-2 font-mono text-xs", p.health === "healthy" ? "text-muted-foreground" : toneText[healthTone[p.health]])}>
            <Square tone={healthTone[p.health]} hollow={p.health === "awaiting_first_event"} />
            {healthLabel[p.health]}
          </span>
          <Mono className="text-xs text-faint">{p.lastEventAt ? `last event ${ago(p.lastEventAt)}` : "no events yet"}</Mono>
          <span className="text-xs text-faint">
            {p.runtimes.map((r) => runtimeLabel[r]).join(" + ")} · {p.environments.map((e) => envShort[e]).join(", ")}
          </span>
        </div>
      </header>
      <Connection data={data} onRotated={(setup) => page.set((d) => ({ ...d, setup }))} />
      <SourceMaps setup={data.setup} projectKey={p.key} />
      <Uptime data={data} onChange={page.reload} />
      <Members data={data} />
      <Delete data={data} />
    </>
  )
}
