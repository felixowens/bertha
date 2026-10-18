import { useEffect, useState } from "react"
import { cn } from "cn"
import { ArrowRight } from "lucide-react"
import type { Environment, Project, ProjectSetup, Runtime } from "../contract/domain"
import { backend, scenario } from "@/data/backend"
import { TopBar } from "@/components/shell/TopBar"
import { useShell } from "@/components/shell/ShellContext"
import { FirstEvent, KeyField, Snippet } from "@/components/projects/Setup"
import { Button } from "@/components/ui/button"
import { Checks, Field, Input } from "@/components/ui/form"
import { Mono, Square } from "@/components/ui/primitives"
import { Skeleton } from "@/components/ui/states"
import { envShort, runtimeLabel } from "@/lib/meaning"
import { Link } from "@/lib/router"

const RUNTIMES: Runtime[] = ["browser", "server", "edge"]
const ENVS: Environment[] = ["production", "staging", "development"]
const POLL_MS = 2500

/** `at` 3 means every step is done. */
function Steps({ at }: { at: 0 | 1 | 2 | 3 }) {
  const steps = ["Name it", "Connect it", "First event"]
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
      {steps.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2", i === at ? "text-foreground" : i < at ? "text-muted-foreground" : "text-faint")} aria-current={i === at ? "step" : undefined}>
          <Square tone={i < at ? "quiet" : i === at ? "fg" : "void"} hollow={i > at} />
          {s}
          {i < steps.length - 1 && <span className="ml-1 text-faint">—</span>}
        </li>
      ))}
    </ol>
  )
}

function NameStep({ onCreated }: { onCreated: (p: Project, s: ProjectSetup) => void }) {
  const [name, setName] = useState("")
  const [client, setClient] = useState("")
  const [url, setUrl] = useState("")
  const [runtimes, setRuntimes] = useState<Runtime[]>(["browser", "server"])
  const [envs, setEnvs] = useState<Environment[]>(["production"])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "name_taken" | "invalid_name"; message: string } | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.createProject({ name: name.trim(), client: client.trim() || null, url: url.trim() || null, runtimes, environments: envs })
    setBusy(false)
    if (r.ok) onCreated(r.value.project, r.value.setup)
    else setError({ kind: r.failure, message: r.message })
  }
  const nameError =
    error?.kind === "name_taken" ? (
      <>
        {error.message}{" "}
        <span className="text-muted-foreground">Names are unique across your projects; add the client or the site, e.g. “{name.trim()} shop”.</span>
      </>
    ) : error?.kind === "invalid_name" ? (
      <>{error.message}</>
    ) : undefined
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="Name" hint="Shown everywhere in bertha. You can't have two with the same name." error={nameError}>
        {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!nameError} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Allotment Planner" />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Client" hint="Optional. Leave empty for your own projects.">
          {(id, d) => <Input id={id} aria-describedby={d} value={client} onChange={(e) => setClient(e.target.value)} />}
        </Field>
        <Field label="Site URL" hint="Optional. Used to suggest an uptime monitor.">
          {(id, d) => <Input id={id} aria-describedby={d} className="font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Where errors come from</span>
        <Checks label="Runtimes" value={runtimes} onChange={setRuntimes} options={RUNTIMES.map((r) => ({ value: r, label: runtimeLabel[r] }))} />
        <span className="text-xs text-faint">Decides what the setup snippet covers.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Environments</span>
        <Checks label="Environments" value={envs} onChange={setEnvs} options={ENVS.map((e) => ({ value: e, label: envShort[e] }))} />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={busy || !name.trim() || runtimes.length === 0}>
          {busy ? "Creating…" : "Create project"} {!busy && <ArrowRight />}
        </Button>
        {runtimes.length === 0 && <span className="text-xs text-faint">Pick at least one runtime.</span>}
      </div>
    </form>
  )
}

function ConnectStep({ project, setup, onSetup: setSetup }: { project: Project; setup: ProjectSetup; onSetup: (s: ProjectSetup) => void }) {
  const shell = useShell()
  const [shown, setShown] = useState(true)
  const live = !!setup.firstEventAt

  // Poll until the first event lands, then stop.
  useEffect(() => {
    if (live) return
    let cancelled = false
    const t = setInterval(async () => {
      const s = await backend.getProjectSetup(project.id)
      if (!cancelled) setSetup(s)
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, project.id])
  useEffect(() => {
    if (live) shell.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base text-foreground">
          <span className="text-muted-foreground">Created</span> {project.name}
          <Mono className="ml-2 rounded-[4px] border border-hairline px-1.5 py-0.5 text-xs text-muted-foreground">{project.key}</Mono>
        </h2>
        <p className="mt-1 text-sm text-faint">Add the key to the app, deploy, and trigger any error. Nothing else to configure.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Connection key</span>
        <KeyField value={setup.ingestKey} shown={shown} onShownChange={setShown} />
      </div>
      <Snippet code={setup.snippet} hide={shown ? undefined : setup.ingestKey} />
      <FirstEvent setup={setup} />
      {live ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link to={`/issues?project=${project.id}`}>
              See its issues <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/projects/${project.id}/settings`}>Add an uptime monitor</Link>
          </Button>
        </div>
      ) : (
        <p className="text-xs text-faint">
          You can leave this page; the project shows as <span className="text-muted-foreground">awaiting first event</span> until something arrives.{" "}
          <Link to={`/projects/${project.id}/settings`} className="text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
            Project settings
          </Link>
        </p>
      )}
    </div>
  )
}

export function NewProject() {
  const [created, setCreated] = useState<{ project: Project; setup: ProjectSetup } | null>(null)
  const resume = scenario.params.projectId
  const [resuming, setResuming] = useState(!!resume)

  // The "waiting" scenario opens on step two for an already-created project.
  useEffect(() => {
    if (!resume) return
    void backend.getProjectSettings(resume).then((d) => {
      if (d) setCreated({ project: d.project, setup: d.setup })
      setResuming(false)
    })
  }, [resume])

  const at = !created ? 0 : created.setup.firstEventAt ? 3 : 1
  return (
    <>
      <TopBar crumbs={[{ label: "New project" }]} />
      <div className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-xl text-foreground md:text-2xl">Add a project</h1>
            <Steps at={at} />
          </div>
          {resuming ? (
            <div className="flex flex-col gap-4" aria-busy>
              <Skeleton className="h-6 w-60" />
              <Skeleton className="h-11" />
              <Skeleton className="h-36" />
            </div>
          ) : created ? (
            <ConnectStep project={created.project} setup={created.setup} onSetup={(setup) => setCreated((c) => c && { ...c, setup })} />
          ) : (
            <NameStep onCreated={(project, setup) => setCreated({ project, setup })} />
          )}
        </div>
      </div>
    </>
  )
}
