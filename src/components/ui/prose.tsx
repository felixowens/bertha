import { useState } from "react"
import { cn } from "cn"
import { Segmented, Textarea } from "@/components/ui/form"
import { Markdown } from "@/lib/markdown"

/** Markdown with a preview, for briefs and triages. The preview renders as it will read. */
export function ProseInput({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  describedBy,
  repoUrl,
  limit,
  label,
  invalid,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  describedBy?: string
  repoUrl: string | null
  limit?: number
  label: string
  invalid?: boolean
}) {
  const [mode, setMode] = useState<"write" | "preview">("write")
  const over = limit !== undefined && value.trim().length > limit
  return (
    <div className="flex flex-col gap-1.5">
      {mode === "write" ? (
        <Textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || over}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="rounded-md border border-hairline bg-card px-3 py-2 text-sm text-muted-foreground" style={{ minHeight: `${rows * 1.625 + 1}rem` }}>
          {value.trim() ? <Markdown source={value} repoUrl={repoUrl} /> : <span className="text-faint">Nothing to preview.</span>}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <Segmented
          label={`${label}: write or preview`}
          value={mode}
          onChange={setMode}
          options={[
            { value: "write", label: "Write" },
            { value: "preview", label: "Preview" },
          ]}
        />
        {limit !== undefined && (
          <span className={cn("font-mono text-xs tabular", over ? "text-danger" : "text-faint")}>
            {value.trim().length}/{limit}
          </span>
        )}
      </div>
    </div>
  )
}
