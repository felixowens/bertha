import { useId, type ComponentProps, type ReactNode } from "react"
import { cn } from "cn"
import { Dialog as D } from "radix-ui"
import { X } from "lucide-react"
import { InlineError } from "./states"
import { CheckBox } from "./menu"
import { Indicator } from "./motion"

/** A centred panel for short forms (add monitor, invite, destination). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px] duration-150 ease-smooth data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <D.Content
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 rounded-xl border border-border bg-popover p-5 shadow-pop outline-none duration-150 ease-smooth data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98] data-[state=closed]:duration-100",
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-base font-medium text-foreground">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="press -m-1 rounded-md p-1 text-faint hover:bg-raised hover:text-foreground" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 ease-smooth placeholder:text-faint hover:border-input focus:border-ring focus:ring-3 focus:ring-ring/15 aria-invalid:border-danger/70 disabled:opacity-50"

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...p} />
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "block h-auto resize-y py-2 leading-relaxed", className)} {...p} />
}

/** Label, control, then either a hint or the error that replaced it. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  error?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}) {
  const id = useId()
  const desc = error || hint ? `${id}-d` : undefined
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      {children(id, desc)}
      {error ? (
        <div id={desc}>
          <InlineError>{error}</InlineError>
        </div>
      ) : hint ? (
        <p id={desc} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** A small set of mutually exclusive choices. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-flex w-fit rounded-[7px] border border-border bg-card p-0.5">
      <Indicator selector='[aria-checked="true"]' watch={value} className="rounded-[5px] bg-raised" />
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("press relative h-7 rounded-[5px] px-3 text-xs", o.value === value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A native select, styled; for long lists like projects. */
export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClass, "pr-2", className)} {...p}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("press relative h-5 w-9 shrink-0 rounded-full border", checked ? "border-foreground bg-foreground" : "border-border bg-raised")}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-3.5 rounded-full transition-[translate,background-color] duration-200 ease-smooth",
          checked ? "translate-x-4 bg-background" : "bg-muted-foreground",
        )}
      />
    </button>
  )
}

/** Several independent choices as checkbox chips (runtimes, triggers, projects). */
export function Checks<T extends string>({
  value,
  options,
  onChange,
  label,
  invalid,
}: {
  value: T[]
  options: { value: T; label: ReactNode; hint?: string }[]
  onChange: (v: T[]) => void
  label: string
  invalid?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            type="button"
            key={o.value}
            role="checkbox"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "press flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs",
              on ? "border-input bg-raised text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              invalid && !on && "border-danger/50",
            )}
          >
            <CheckBox checked={on} />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
