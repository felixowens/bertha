import type { Environment, Runtime } from "../../contract/domain"
import type { ProjectInput } from "../../contract/actions"
import { Checks, Field, Input } from "@/components/ui/form"
import { envShort, runtimeLabel } from "@/lib/meaning"

export const RUNTIMES: Runtime[] = ["browser", "server", "edge"]
export const ENVS: Environment[] = ["production", "staging", "development"]

export type ProjectDraft = { name: string; client: string; url: string; repoUrl: string; runtimes: Runtime[]; environments: Environment[] }

export const draftOf = (p?: Partial<ProjectInput>): ProjectDraft => ({
  name: p?.name ?? "",
  client: p?.client ?? "",
  url: p?.url ?? "",
  repoUrl: p?.repoUrl ?? "",
  runtimes: p?.runtimes ?? ["browser", "server"],
  environments: p?.environments ?? ["production"],
})

export const inputOf = (d: ProjectDraft): Omit<ProjectInput, "brief"> => ({
  name: d.name.trim(),
  client: d.client.trim() || null,
  url: d.url.trim() || null,
  repoUrl: d.repoUrl.trim() || null,
  runtimes: d.runtimes,
  environments: d.environments,
})

/** Name, client, site, repo, runtimes and environments: shared by New project and Settings. */
export function ProjectFields({
  draft: d,
  onChange,
  nameError,
  namePlaceholder = "e.g. Allotment Planner",
  autoFocus,
  afterName,
}: {
  draft: ProjectDraft
  onChange: (d: ProjectDraft) => void
  nameError?: React.ReactNode
  namePlaceholder?: string
  autoFocus?: boolean
  /** Slot under the name, for the key. */
  afterName?: React.ReactNode
}) {
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => onChange({ ...d, [k]: v })
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="Name" hint="Shown everywhere in bertha. You can't have two with the same name." error={nameError}>
          {(id, h) => (
            <Input
              id={id}
              aria-describedby={h}
              aria-invalid={!!nameError}
              autoFocus={autoFocus}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={namePlaceholder}
            />
          )}
        </Field>
        {afterName}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Client" hint="Optional. Leave empty for your own projects.">
          {(id, h) => <Input id={id} aria-describedby={h} value={d.client} onChange={(e) => set("client", e.target.value)} />}
        </Field>
        <Field label="Site URL" hint="Optional. Suggested for uptime monitors.">
          {(id, h) => (
            <Input id={id} aria-describedby={h} className="font-mono" spellCheck={false} value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
          )}
        </Field>
      </div>
      <Field label="Repository URL" hint="Optional. Commits on releases link here.">
        {(id, h) => (
          <Input
            id={id}
            aria-describedby={h}
            className="font-mono"
            spellCheck={false}
            value={d.repoUrl}
            onChange={(e) => set("repoUrl", e.target.value)}
            placeholder="https://github.com/you/app"
          />
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Where errors come from</span>
        <Checks label="Runtimes" value={d.runtimes} onChange={(v) => set("runtimes", v)} options={RUNTIMES.map((r) => ({ value: r, label: runtimeLabel[r] }))} />
        <span className="text-xs text-faint">{d.runtimes.length ? "Decides what the setup snippet covers." : "Pick at least one runtime."}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Environments</span>
        <Checks label="Environments" value={d.environments} onChange={(v) => set("environments", v)} options={ENVS.map((e) => ({ value: e, label: envShort[e] }))} />
      </div>
    </div>
  )
}
