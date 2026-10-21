import { type ReactNode, useState } from "react"
import { cn } from "cn"
import { Check, Copy, Eye, EyeOff } from "lucide-react"
import type { ProjectSetup, SetupSnippet } from "../../contract/domain"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/form"
import { Mono, Square } from "@/components/ui/primitives"
import { LoadingCells } from "@/components/ui/states"
import { ago, stamp } from "@/lib/format"

function useCopy() {
  const [copied, setCopied] = useState(false)
  return {
    copied,
    copy: (text: string) => {
      void navigator.clipboard?.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    },
  }
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const { copied, copy } = useCopy()
  return (
    <Button variant="ghost" size="sm" className={cn("text-muted-foreground", className)} onClick={() => copy(text)} aria-live="polite">
      {copied ? <Check key="done" className="animate-check text-ok" /> : <Copy key="copy" className="animate-appear" />} {copied ? "Copied" : label}
    </Button>
  )
}

export const maskKey = (k: string) => k.slice(0, 4) + "•".repeat(Math.max(0, k.length - 8)) + k.slice(-4)

/** The connection key, masked until asked (screen-sharing a client call is common). */
export function KeyField({
  value,
  fresh,
  shown,
  onShownChange,
  label = "Connection key",
}: {
  value: string
  fresh?: boolean
  shown: boolean
  onShownChange: (s: boolean) => void
  label?: string
}) {
  const masked = maskKey(value)
  return (
    <div className={cn("flex items-center gap-1 rounded-md border bg-sidebar py-1 pr-1 pl-3", fresh ? "border-foreground/40" : "border-hairline")}>
      <Mono className="min-w-0 flex-1 truncate text-sm text-foreground" aria-label={shown ? label : `${label}, hidden`}>
        {shown ? value : masked}
      </Mono>
      <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => onShownChange(!shown)} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        {shown ? <EyeOff /> : <Eye />}
      </Button>
      <CopyButton text={value} />
    </div>
  )
}

/** The setup snippet: comments dim, everything else as typed. */
export function Snippet({ code, hide, label = "setup", control }: { code: string; hide?: string; label?: string; control?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-sidebar">
      <div className={cn("flex items-center justify-between gap-2 border-b border-hairline py-1 pr-1", control ? "pl-1" : "pl-4")}>
        {control ?? <span className="font-mono text-2xs text-faint">{label}</span>}
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        {code.split("\n").map((l, i) => (
          <div key={i} className={l.startsWith("#") ? "text-faint" : "text-foreground"}>
            {(hide ? l.replace(hide, maskKey(hide)) : l) || " "}
          </div>
        ))}
      </pre>
    </div>
  )
}

const SDK_KEY = "bertha.setup.sdk"
const readSdk = () => {
  try {
    return localStorage.getItem(SDK_KEY)
  } catch {
    return null
  }
}

/** One snippet per SDK, with a choice between them when there's more than one. The choice is kept per browser. */
export function Snippets({ snippets, hide }: { snippets: SetupSnippet[]; hide?: string }) {
  const [chosen, setChosen] = useState(readSdk)
  const current = snippets.find((s) => s.label === chosen) ?? snippets[0]
  if (!current) return null
  const choose = (label: string) => {
    setChosen(label)
    try {
      localStorage.setItem(SDK_KEY, label)
    } catch {
      /* per-viewer convenience only */
    }
  }
  return (
    <Snippet
      code={current.code}
      hide={hide}
      label={current.label}
      control={
        snippets.length > 1 ? (
          <Segmented label="SDK" value={current.label} onChange={choose} options={snippets.map((s) => ({ value: s.label, label: s.label }))} />
        ) : undefined
      }
    />
  )
}

/** Has anything arrived yet? Listening reads as a row of cells filling in turn. */
export function FirstEvent({ setup, lastEventAt }: { setup: ProjectSetup; lastEventAt?: string | null }) {
  if (!setup.firstEventAt)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3">
        <LoadingCells label="Listening for the first event" />
        <span className="text-sm text-foreground">Listening for the first event…</span>
        <span className="text-xs text-faint">Deploy with this project's key, then trigger any error. This updates by itself.</span>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline px-4 py-3">
      <Square tone="ok" />
      <span className="text-sm text-foreground">Connected</span>
      <Mono className="text-xs text-faint">
        first event {stamp(setup.firstEventAt)}
        {lastEventAt ? ` · latest ${ago(lastEventAt)}` : ""}
      </Mono>
    </div>
  )
}
