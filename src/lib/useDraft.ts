import { useEffect, useEffectEvent, useState } from "react"

/**
 * A text field's own value that commits after `ms` without typing, for a search box
 * that writes to the URL. When `value` changes from elsewhere (back, a link) the draft
 * follows it.
 */
export function useDraft(value: string, ms: number, commit: (draft: string) => void): [string, (draft: string) => void] {
  const [draft, setDraft] = useState(value)
  const [was, setWas] = useState(value)
  if (value !== was) {
    setWas(value)
    setDraft(value)
  }
  const settle = useEffectEvent(commit)
  useEffect(() => {
    if (draft === value) return
    const t = setTimeout(() => settle(draft), ms)
    return () => clearTimeout(t)
  }, [draft, value, ms])
  return [draft, setDraft]
}
