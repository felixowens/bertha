import { useState } from "react"
import { cn } from "cn"
import { ChevronRight } from "lucide-react"
import type { StackFrame } from "../../contract/domain"
import { Mono } from "@/components/ui/primitives"
import { Link } from "@/lib/router"

type Group = { kind: "app"; frame: StackFrame; index: number } | { kind: "vendor"; frames: StackFrame[]; start: number }

/** Consecutive dependency/runtime frames fold into one line; your code stays open. */
function group(frames: StackFrame[]): Group[] {
  const out: Group[] = []
  frames.forEach((f, i) => {
    const last = out.at(-1)
    if (f.inApp) out.push({ kind: "app", frame: f, index: i })
    else if (last?.kind === "vendor") last.frames.push(f)
    else out.push({ kind: "vendor", frames: [f], start: i })
  })
  return out
}

function where(f: StackFrame) {
  return f.line === null ? "" : `:${f.line}${f.column !== null ? `:${f.column}` : ""}`
}

function Context({ ctx }: { ctx: NonNullable<StackFrame["context"]> }) {
  return (
    <div className="overflow-x-auto border-t border-hairline bg-sidebar/60 py-2 font-mono text-xs leading-5">
      {ctx.lines.map((l, k) => {
        const n = ctx.startLine + k
        const hit = n === ctx.highlight
        return (
          <div key={k} className={cn("flex min-w-max pr-4", hit ? "bg-danger/10 text-foreground" : "text-muted-foreground")}>
            <span className={cn("w-12 shrink-0 pr-3 text-right select-none", hit ? "text-danger" : "text-faint")}>{n}</span>
            <span className={cn("w-1 shrink-0", hit && "bg-danger")} aria-hidden />
            <span className="pl-3 whitespace-pre">{l || " "}</span>
          </div>
        )
      })}
    </div>
  )
}

function Frame({ f, open, onToggle, top }: { f: StackFrame; open: boolean; onToggle: () => void; top?: boolean }) {
  const canOpen = !!f.context
  return (
    <li className={cn("border-b border-hairline last:border-b-0", !f.inApp && "bg-sidebar/40")}>
      <button
        onClick={onToggle}
        disabled={!canOpen}
        aria-expanded={canOpen ? open : undefined}
        className="flex w-full min-w-0 items-center gap-2 px-4 py-2 text-left disabled:cursor-default"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-faint transition-transform duration-150", open && "rotate-90", !canOpen && "invisible")} />
        <Mono className={cn("min-w-0 truncate text-xs", f.inApp ? "text-foreground" : "text-faint")} title={f.file}>
          {f.file.replace(/^https?:\/\/[^/]+/, "")}
          <span className="text-faint">{where(f)}</span>
        </Mono>
        {f.function && <Mono className={cn("hidden min-w-0 shrink truncate text-xs sm:inline", f.inApp ? "text-muted-foreground" : "text-faint")}>in {f.function}</Mono>}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {top && <Mono className="text-2xs text-danger">thrown here</Mono>}
          {!f.mapped && <Mono className="rounded-[3px] border border-warn/40 px-1 text-2xs text-warn">minified</Mono>}
        </span>
      </button>
      {open && f.context && <Context ctx={f.context} />}
    </li>
  )
}

export function StackTrace({ frames, projectId }: { frames: StackFrame[]; projectId: string }) {
  const firstApp = frames.findIndex((f) => f.inApp && f.context)
  const [openFrames, setOpen] = useState<Set<number>>(() => new Set(firstApp >= 0 ? [firstApp] : []))
  const [openGroups, setGroups] = useState<Set<number>>(new Set())
  const toggle = (i: number) => setOpen((s) => (s.has(i) ? (s.delete(i), new Set(s)) : new Set(s.add(i))))
  const unmapped = frames.filter((f) => !f.mapped).length
  const appCount = frames.filter((f) => f.inApp).length
  const groups = group(frames)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-faint">
        <span>
          <Mono className="text-muted-foreground">{frames.length}</Mono> frames · <Mono className="text-muted-foreground">{appCount}</Mono> in your code · innermost first
        </span>
        {openFrames.size > 0 && (
          <button className="hover:text-foreground" onClick={() => setOpen(new Set())}>
            Collapse all
          </button>
        )}
      </div>
      {unmapped > 0 && (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-1.5 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-muted-foreground">
          <Mono className="text-warn">{unmapped === frames.length ? "No source maps." : `${unmapped} of ${frames.length} frames are minified.`}</Mono>
          Upload source maps for this release and new events will show your original code.
          <Link to={`/projects/${projectId}/settings#source-maps`} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
            How
          </Link>
        </p>
      )}
      <ol className="overflow-hidden rounded-lg border border-hairline bg-card">
        {groups.map((g) =>
          g.kind === "app" ? (
            <Frame key={g.index} f={g.frame} top={g.index === 0} open={openFrames.has(g.index)} onToggle={() => toggle(g.index)} />
          ) : openGroups.has(g.start) || g.frames.length === 1 ? (
            g.frames.map((f, k) => <Frame key={g.start + k} f={f} top={g.start + k === 0} open={openFrames.has(g.start + k)} onToggle={() => toggle(g.start + k)} />)
          ) : (
            <li key={`g${g.start}`} className="border-b border-hairline bg-sidebar/40 last:border-b-0">
              <button onClick={() => setGroups((s) => new Set(s.add(g.start)))} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-faint hover:text-muted-foreground">
                <span className="flex w-3.5 justify-center gap-[2px]" aria-hidden>
                  <span className="size-[3px] rounded-[0.5px] bg-current" />
                  <span className="size-[3px] rounded-[0.5px] bg-current" />
                </span>
                <Mono>{g.frames.length}</Mono> framework and library frames
                <Mono className="ml-auto truncate text-2xs">{commonRoot(g.frames)}</Mono>
              </button>
            </li>
          ),
        )}
      </ol>
    </div>
  )
}

function commonRoot(frames: StackFrame[]) {
  const pkg = (file: string) => {
    const m = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)
    if (m) return m[1]
    if (/^(https?:|webpack:|\/_next\/)/.test(file) || file.includes("/chunks/")) return "bundled chunks"
    return file.startsWith("node:") ? "node" : file.split("/")[0]
  }
  const pkgs = [...new Set(frames.map((f) => pkg(f.file)))]
  return pkgs.slice(0, 3).join(", ") + (pkgs.length > 3 ? ` +${pkgs.length - 3}` : "")
}
