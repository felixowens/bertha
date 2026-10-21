import { useEffect, useState } from "react"
import { cn } from "cn"
import { ArrowRight } from "lucide-react"
import type { Project, ProjectSetup } from "../contract/domain"
import { backend, scenario } from "@/data/backend"
import { TopBar } from "@/components/shell/TopBar"
import { useShell } from "@/components/shell/ShellContext"
import { FirstEvent, KeyField, Snippets } from "@/components/projects/Setup"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/form"
import { ProjectFields, draftOf, inputOf, type ProjectDraft } from "@/components/projects/ProjectFields"
import { Mono, Square } from "@/components/ui/primitives"
import { EmptyState, Skeleton } from "@/components/ui/states"
import { KEY_PATTERN, keyFromName, uniqueKey } from "@/lib/keys"
import { Link, navigate } from "@/lib/router"
const POLL_MS = 2500

/** `at` 3 means every step is done. */
function Steps({ at }: { at: 0 | 1 | 2 | 3 }) {
  const steps = ["Name it", "Connect it", "First event"]
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cn("flex items-center gap-2", i === at ? "text-foreground" : i < at ? "text-muted-foreground" : "text-faint")}
          aria-current={i === at ? "step" : undefined}
        >
          <Square tone={i < at ? "ok" : i === at ? "fg" : "void"} hollow={i > at} />
          {s}
          {i < steps.length - 1 && <span className="ml-1 text-faint">—</span>}
        </li>
      ))}
    </ol>
  )
}

function NameStep({ onCreated }: { onCreated: (p: Project, s: ProjectSetup) => void }) {
  const shell = useShell()
  const [draft, setDraft] = useState<ProjectDraft>(draftOf())
  const [key, setKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: "name_taken" | "invalid_name" | "key_taken" | "invalid_key"; message: string } | null>(null)
  const taken = shell.projects.map((p) => p.key)
  const suggested = draft.name.trim() ? uniqueKey(keyFromName(draft.name), taken) : ""
  const typed = key.trim().toUpperCase()
  const finalKey = typed || suggested
  const keyBad = !!typed && !KEY_PATTERN.test(typed)
  const keyClash = !!typed && taken.includes(typed)
  // An example that can't collide with a project that already exists.
  const placeholder = ["Allotment Planner", "Tide Tables", "Bell Ringers"].find((n) => !shell.projects.some((p) => p.name === n)) ?? "e.g. Tide Tables"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await backend.createProject({ ...inputOf(draft), key: typed || undefined })
    setBusy(false)
    if (r.ok) onCreated(r.value.project, r.value.setup)
    else setError({ kind: r.failure, message: r.message })
  }
  const nameError =
    error?.kind === "name_taken" ? (
      <>
        {error.message} <span className="text-muted-foreground">Names are unique across your projects; add the client or the site, e.g. “{draft.name.trim()} shop”.</span>
      </>
    ) : error?.kind === "invalid_name" ? (
      <>{error.message}</>
    ) : undefined
  const keyError =
    error?.kind === "key_taken" || error?.kind === "invalid_key"
      ? error.message
      : keyBad
        ? "2 to 6 capital letters or digits, starting with a letter."
        : keyClash
          ? `${typed} is already used by another project.`
          : undefined
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <ProjectFields
        draft={draft}
        onChange={(d) => {
          setDraft(d)
          if (error?.kind === "name_taken" || error?.kind === "invalid_name") setError(null)
        }}
        nameError={nameError}
        namePlaceholder={placeholder.startsWith("e.g.") ? placeholder : `e.g. ${placeholder}`}
        autoFocus
        afterName={
          <Field
            label="Key"
            hint={
              <>
                Starts every issue ID: <Mono className="text-muted-foreground">{finalKey || "KEY"}-1A</Mono>. Can't change later.
              </>
            }
            error={keyError}
          >
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                aria-invalid={!!keyError}
                className="w-28 font-mono uppercase"
                maxLength={6}
                spellCheck={false}
                autoComplete="off"
                value={key}
                placeholder={suggested || "KEY"}
                onChange={(e) => {
                  setKey(e.target.value.toUpperCase())
                  if (error?.kind === "key_taken" || error?.kind === "invalid_key") setError(null)
                }}
              />
            )}
          </Field>
        }
      />
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={busy || !draft.name.trim() || draft.runtimes.length === 0 || keyBad || keyClash}>
          {busy ? "Creating…" : "Create project"} {!busy && <ArrowRight />}
        </Button>
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
      <Snippets snippets={setup.snippets} hide={shown ? undefined : setup.ingestKey} />
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

/** Step one at /projects/new; steps two and three at /projects/:id/connect, so a reload keeps the snippet. */
export function NewProject({ projectId }: { projectId?: string }) {
  const shell = useShell()
  const [created, setCreated] = useState<{ project: Project; setup: ProjectSetup } | null>(null)
  const resume = projectId ?? scenario.params.projectId
  const [resuming, setResuming] = useState(!!resume)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!resume) return
    setResuming(true)
    void backend.getProjectSettings(resume).then((d) => {
      if (d) setCreated({ project: d.project, setup: d.setup })
      else setMissing(true)
      setResuming(false)
    })
  }, [resume])

  const at = !created ? 0 : created.setup.firstEventAt ? 3 : 1
  return (
    <>
      <TopBar crumbs={[{ label: "Projects", to: "/projects" }, { label: created ? created.project.name : "New project" }]} />
      <div className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-xl text-foreground md:text-2xl">{created ? "Connect it" : "Add a project"}</h1>
            <Steps at={at} />
          </div>
          {resuming ? (
            <div className="flex flex-col gap-4" aria-busy>
              <Skeleton className="h-6 w-60" />
              <Skeleton className="h-11" />
              <Skeleton className="h-36" />
            </div>
          ) : missing ? (
            <EmptyState
              cells="void"
              title="No such project."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/projects/new">Start a new one</Link>
                </Button>
              }
            >
              It may have been deleted, or you don't have access to it.
            </EmptyState>
          ) : created ? (
            <ConnectStep project={created.project} setup={created.setup} onSetup={(setup) => setCreated((c) => c && { ...c, setup })} />
          ) : (
            <NameStep
              onCreated={(project, setup) => {
                setCreated({ project, setup })
                shell.reload()
                navigate(`/projects/${project.id}/connect`, { replace: true })
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}
