import { useEffect, useState } from "react"
import { cn } from "cn"
import { KeyRound, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react"
import type { Monitor, Project, ProjectSetup } from "../contract/domain"
import type { MonitorInput } from "../contract/actions"
import type { ProjectSettingsPage } from "../contract/pages"
import { backend } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { TopBar } from "@/components/shell/TopBar"
import { useShell, isOwner } from "@/components/shell/ShellContext"
import { FirstEvent, KeyField, Snippet } from "@/components/projects/Setup"
import { ProjectHeader } from "@/components/projects/ProjectHeader"
import { ProjectFields, draftOf, inputOf, type ProjectDraft } from "@/components/projects/ProjectFields"
import { MonitorForm } from "@/components/uptime/MonitorForm"
import { Ribbon } from "@/components/charts/cells"
import { Button } from "@/components/ui/button"
import { Dialog, Field, Input, Switch } from "@/components/ui/form"
import { Avatar, Mono, Square, toneText } from "@/components/ui/primitives"
import { toast } from "@/components/ui/toast"
import { ProseInput } from "@/components/ui/prose"
import { Markdown } from "@/lib/markdown"
import { EmptyState, ErrorState, InlineError, Skeleton } from "@/components/ui/states"
import { plural } from "@/lib/format"
import { envShort, monitorLabel, monitorTone, runtimeLabel } from "@/lib/meaning"
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
  const owner = isOwner(useShell())
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
      {owner ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
            <KeyRound /> Rotate key
          </Button>
        </div>
      ) : (
        <p className="text-xs text-faint">Only the owner can rotate the key.</p>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Rotate the connection key?"
        description="The current key stops working the moment you confirm. Events from apps still using it are dropped until they're redeployed with the new one."
      >
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
          <Square tone="ok" /> Uploaded for <Mono className="text-foreground">{sm.latestRelease}</Mono>, the latest release.
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

function Details({ data, onSaved }: { data: Data; onSaved: (p: Project) => void }) {
  const shell = useShell()
  const owner = isOwner(shell)
  const p = data.project
  const [draft, setDraft] = useState<ProjectDraft>(() => draftOf(p))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "name_taken" | "invalid_name" | "permission_denied"; message: string } | null>(null)
  const saved = JSON.stringify(inputOf(draftOf(p)))
  const dirty = JSON.stringify(inputOf(draft)) !== saved

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.updateProject(p.id, { ...inputOf(draft), brief: data.brief })
    setBusy(false)
    if (r.ok) {
      onSaved(r.value)
      setDraft(draftOf(r.value))
      shell.reload()
      toast({ tone: "ok", body: "Project saved." })
    } else setError({ kind: r.failure, message: r.message })
  }

  if (!owner)
    return (
      <Block title="Details" intro="Only the owner can change these.">
        <dl className="flex flex-col text-sm">
          {(
            [
              ["Name", p.name],
              ["Client", p.client ?? "Personal project"],
              ["Site", p.url ? <Mono key="u">{p.url}</Mono> : "—"],
              ["Repository", p.repoUrl ? <Mono key="r">{p.repoUrl}</Mono> : "—"],
              ["Runs on", p.runtimes.map((r) => runtimeLabel[r]).join(", ")],
              ["Environments", p.environments.map((e) => envShort[e]).join(", ")],
            ] as [string, React.ReactNode][]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
              <dt className="text-faint">{k}</dt>
              <dd className="truncate text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Block>
    )

  return (
    <Block
      title="Details"
      intro={
        <>
          The key <Mono className="text-muted-foreground">{p.key}</Mono> can't change: every issue ID already uses it.
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <ProjectFields
          draft={draft}
          onChange={(d) => {
            setDraft(d)
            setError(null)
          }}
          nameError={error?.kind === "name_taken" || error?.kind === "invalid_name" ? error.message : undefined}
        />
        {error?.kind === "permission_denied" && <InlineError>{error.message}</InlineError>}
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={!dirty || busy || !draft.name.trim() || !draft.runtimes.length}>
            {busy ? "Saving…" : "Save details"}
          </Button>
          {dirty && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(draftOf(p))
                setError(null)
              }}
            >
              Discard changes
            </Button>
          )}
        </div>
      </form>
    </Block>
  )
}

const BRIEF_LIMIT = 4000

/** What anyone triaging should know first. Agents read it with every issue. */
function Brief({ data, onSaved }: { data: Data; onSaved: (brief: string | null) => void }) {
  const owner = isOwner(useShell())
  const p = data.project
  const [draft, setDraft] = useState(data.brief ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = draft.trim() !== (data.brief ?? "")
  const intro = "What anyone triaging this project should know first: the stack, where it runs, known noise. People and agents see it with every issue."

  if (!owner)
    return (
      <Block id="brief" title="Brief" intro={intro}>
        {data.brief ? (
          <div className="text-sm text-muted-foreground">
            <Markdown source={data.brief} repoUrl={p.repoUrl} />
          </div>
        ) : (
          <p className="text-sm text-faint">No brief yet. Only the owner can write one.</p>
        )}
      </Block>
    )

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const brief = draft.trim() || null
    try {
      const r = await backend.updateProject(p.id, { ...inputOf(draftOf(p)), brief })
      if (r.ok) {
        onSaved(brief)
        setDraft(brief ?? "")
        toast({ tone: "ok", body: brief ? "Brief saved." : "Brief removed." })
      } else setError(r.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Block id="brief" title="Brief" intro={intro}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Brief" hint="Markdown. Short and specific beats complete." error={error ?? undefined}>
          {(id, d) => (
            <ProseInput
              id={id}
              describedBy={d}
              label="Brief"
              rows={7}
              value={draft}
              invalid={!!error}
              onChange={(v) => {
                setDraft(v)
                setError(null)
              }}
              repoUrl={p.repoUrl}
              limit={BRIEF_LIMIT}
              placeholder={"e.g. Next.js on Vercel. Payments through Stripe.\n\n- `ResizeObserver loop` errors are browser noise."}
            />
          )}
        </Field>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={!dirty || busy || draft.trim().length > BRIEF_LIMIT}>
            {busy ? "Saving…" : "Save brief"}
          </Button>
          {dirty && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(data.brief ?? "")}>
              Discard changes
            </Button>
          )}
        </div>
      </form>
    </Block>
  )
}

const WATCHING: Record<Data["fixWatching"], React.ReactNode> = {
  on: "bertha resolves issues when their fix ships.",
  off: "Turned off. Mark fixes shipped by hand from the issue.",
  no_token: (
    <>
      Set <Mono className="text-foreground">BERTHA_GITHUB_TOKEN</Mono> to have bertha watch fixes. Until then, mark fixes shipped by hand.
    </>
  ),
  not_github: "Only GitHub repos are watched. Mark fixes shipped by hand from the issue.",
  no_repo: "Add the repository above to have bertha watch fixes. Until then, mark fixes shipped by hand.",
}

/** Whether a fixed triage's PR is followed to production, which resolves the issue. */
function FixWatching({ data, onSaved }: { data: Data; onSaved: (watchFixes: boolean) => void }) {
  const owner = isOwner(useShell())
  const p = data.project
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intro = "When a triage ends fixed with a PR, bertha follows it until a production release contains it, then resolves the issue."

  const save = async (watchFixes: boolean) => {
    setBusy(true)
    setError(null)
    const r = await backend.updateProject(p.id, { ...inputOf(draftOf(p)), brief: data.brief, watchFixes })
    setBusy(false)
    if (r.ok) {
      onSaved(watchFixes)
      toast({ tone: "quiet", body: watchFixes ? "Watching fixes on GitHub." : "Stopped watching fixes. Mark them shipped by hand." })
    } else setError(r.message)
  }

  return (
    <Block id="fixes" title="Fixes" intro={intro}>
      <div className="flex items-start gap-3">
        {owner && <Switch checked={data.watchFixes} onChange={(v) => !busy && void save(v)} label="Watch fixes on GitHub" />}
        <div className="min-w-0">
          <p className="text-sm text-foreground">Watch fixes on GitHub</p>
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
            {WATCHING[data.fixWatching]}
            {!owner && <span className="text-faint"> Only the owner can change this.</span>}
          </p>
        </div>
      </div>
      {error && <InlineError>{error}</InlineError>}
    </Block>
  )
}

function Monitors({ data, onChange }: { data: Data; onChange: () => void }) {
  const shell = useShell()
  const owner = isOwner(shell)
  const [editing, setEditing] = useState<Monitor | "new" | null>(null)
  const [pausing, setPausing] = useState<string | null>(null)
  const ms = data.monitors

  const pause = async (m: Monitor) => {
    setPausing(m.id)
    const paused = m.state !== "paused"
    const r = await backend.saveMonitor({
      id: m.id,
      projectId: m.projectId,
      name: m.name,
      url: m.url,
      intervalSeconds: m.intervalSeconds as MonitorInput["intervalSeconds"],
      paused,
    })
    setPausing(null)
    if (r.ok) {
      toast({
        tone: "quiet",
        body: paused ? (
          <>
            Paused <span className="text-foreground">{m.name}</span>. No checks until you resume it.
          </>
        ) : (
          <>
            Resumed <span className="text-foreground">{m.name}</span>.
          </>
        ),
      })
      onChange()
      shell.reload()
    } else toast({ tone: "danger", body: r.message })
  }

  return (
    <Block id="uptime" title="Uptime" intro="URLs checked on a schedule. When one stops answering, the project shows as down.">
      {ms.length ? (
        <ul className="overflow-hidden rounded-lg border border-hairline bg-card">
          {ms.map((m) => (
            <li key={m.id} className="flex flex-col gap-2.5 border-b border-hairline p-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Link to={`/uptime/${m.id}`} className="flex min-w-0 items-center gap-2 text-sm text-foreground underline-fade">
                  <Square tone={monitorTone[m.state]} hollow={m.state === "paused"} />
                  <span className="truncate">{m.name}</span>
                </Link>
                <Mono className={cn("text-xs", m.state === "up" ? "text-faint" : toneText[monitorTone[m.state]])}>
                  {monitorLabel[m.state].toLowerCase()} · {m.uptime30d.toFixed(2)}% · every {m.intervalSeconds / 60}m
                </Mono>
              </div>
              <Mono className="truncate text-xs text-faint">{m.url}</Mono>
              <Ribbon states={m.recent.map((s) => (s ? monitorTone[s] : "void"))} cellClass="h-4 w-[5px]" label={`Last ${m.recent.length} checks`} />
              {owner && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => setEditing(m)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pausing === m.id} onClick={() => void pause(m)}>
                    {m.state === "paused" ? <Play /> : <Pause />} {m.state === "paused" ? "Resume" : "Pause"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
          <span className="text-sm text-faint">
            No monitors. bertha won't notice if {data.project.url ? <Mono>{data.project.url.replace(/^https?:\/\//, "")}</Mono> : "the site"} goes down.
          </span>
        </div>
      )}
      {owner && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus /> {ms.length ? "Add another monitor" : "Add monitor"}
          </Button>
        </div>
      )}
      {owner && (
        <MonitorForm
          key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          projects={[data.project]}
          initial={editing && editing !== "new" ? editing : undefined}
          onSaved={(m) => {
            toast({
              tone: "quiet",
              body:
                editing === "new" ? (
                  <>
                    Monitoring <span className="text-foreground">{m.name}</span>. First check passed.
                  </>
                ) : (
                  <>
                    Saved <span className="text-foreground">{m.name}</span>.
                  </>
                ),
            })
            onChange()
            shell.reload()
          }}
          onDeleted={() => {
            toast({ tone: "quiet", body: "Monitor deleted." })
            onChange()
            shell.reload()
          }}
        />
      )}
    </Block>
  )
}

function Members({ data }: { data: Data }) {
  const shell = useShell()
  return (
    <Block
      title="Who can see it"
      intro={
        isOwner(shell) ? (
          <>
            Collaborators see only the projects they're given.{" "}
            <Link to="/settings/team" className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
              Manage on Team
            </Link>
          </>
        ) : (
          "Collaborators see only the projects they're given."
        )
      }
    >
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
            <Mono className="shrink-0 text-xs text-faint">
              {m.joinedAt === null ? "invited" : m.role === "owner" ? "owner · all projects" : plural(m.projectIds === "all" ? 0 : m.projectIds.length, "project")}
            </Mono>
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
      toast({
        tone: "quiet",
        body: (
          <>
            Deleted <span className="text-foreground">{p.name}</span> and its events.
          </>
        ),
      })
      shell.reload()
      navigate("/projects")
    } else setError({ kind: r.failure, message: r.message })
  }
  return (
    <Block danger title="Delete project" intro="Removes its issues, events, releases and monitors. There's no undo.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/25 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {p.unresolvedIssues ? `${plural(p.unresolvedIssues, "unresolved issue")} and every event go with it.` : "Every issue and event goes with it."}
        </span>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 /> Delete…
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${p.name}?`}
        description="Its issues, events, releases and monitors are removed for everyone. Apps still sending to it will get errors back."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label={`Type the project name to confirm`}
            hint={
              <>
                Exactly: <Mono className="text-foreground">{p.name}</Mono>
              </>
            }
            error={
              error?.kind === "name_mismatch" ? (
                <>
                  That doesn't match. Type <Mono className="text-foreground">{p.name}</Mono> exactly; capitals count.
                </>
              ) : undefined
            }
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={error?.kind === "name_mismatch"}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            )}
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
  const shell = useShell()
  const page = usePageLoadable<Data>("/projects/:projectId/settings", () => backend.getProjectSettings(projectId), [projectId])
  const { state } = page

  // Arriving at #source-maps from a stack trace: scroll once the block exists.
  useEffect(() => {
    if (state.status === "ready" && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [state.status])

  const known = shell.projects.find((x) => x.id === projectId)
  const name = state.status === "ready" ? state.data.project.name : (known?.name ?? "Project")
  const crumbs = [{ label: "Projects", to: "/projects" }, { label: name, to: `/projects/${projectId}` }, { label: "Settings" }]
  if (state.status === "loading")
    return (
      <>
        <TopBar crumbs={crumbs} />
        {known ? (
          <ProjectHeader project={known} active="settings" />
        ) : (
          <div className="flex flex-col gap-4 px-4 pt-4 md:px-6 md:pt-6">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
        )}
        <div className="flex flex-col gap-4 p-4 md:p-6" aria-busy>
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
        </div>
      </>
    )
  if (state.status === "error")
    return (
      <>
        <TopBar crumbs={crumbs} />
        {known && <ProjectHeader project={known} active="settings" />}
        <ErrorState className="p-6 md:p-10" message={state.message} onRetry={page.reload} />
      </>
    )
  if (state.status === "empty")
    return (
      <>
        <TopBar crumbs={[{ label: "Project not found" }]} />
        <EmptyState
          className="p-6 md:p-10"
          cells="void"
          title="No such project."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/projects">All projects</Link>
            </Button>
          }
        >
          It was deleted, or you don't have access to it.
        </EmptyState>
      </>
    )

  const data = state.data
  const p = data.project
  const refresh = async () => {
    const fresh = await backend.getProjectSettings(projectId)
    if (fresh) page.set(() => fresh)
  }
  return (
    <>
      <TopBar crumbs={crumbs} />
      <ProjectHeader project={p} active="settings" monitors={data.monitors} />
      <Details
        data={data}
        onSaved={(project) => {
          page.set((d) => ({ ...d, project }))
          // A new repository can change whether its fixes are watched.
          void refresh()
        }}
      />
      <Brief data={data} onSaved={(brief) => page.set((d) => ({ ...d, brief }))} />
      <FixWatching data={data} onSaved={() => void refresh()} />
      <Connection data={data} onRotated={(setup) => page.set((d) => ({ ...d, setup }))} />
      <SourceMaps setup={data.setup} projectKey={p.key} />
      <Monitors data={data} onChange={page.reload} />
      <Members data={data} />
      {isOwner(shell) && <Delete data={data} />}
    </>
  )
}
