// The issue search's tokens. Mirrors `split_query` in bertha.
import { normalizeLabel } from "@/lib/labels"

export type Search = {
  text: string
  labels: string[]
  /** Tag key and value, lowercased: an issue must have had each on some event. */
  tags: [string, string][]
}

const TAG_KEY = /^[a-z_][a-z0-9_.-]*$/i

/**
 * Splits `label:x` and `key:value` tokens out of a search: "label:checkout area:cart timeout"
 * → text "timeout", labels ["checkout"], tags [["area", "cart"]]. A value starting with `//`
 * is a URL, so `https://…` stays free text.
 */
export function splitQuery(query: string): Search {
  const text: string[] = []
  const labels: string[] = []
  const tags: [string, string][] = []
  for (const word of query.split(/\s+/).filter(Boolean)) {
    const at = word.indexOf(":")
    const key = at < 0 ? "" : word.slice(0, at)
    const value = word.slice(at + 1)
    if (key.toLowerCase() === "label" && value) labels.push(normalizeLabel(value) ?? value.toLowerCase())
    else if (TAG_KEY.test(key) && value && !value.startsWith("//")) tags.push([key.toLowerCase(), value.toLowerCase()])
    else text.push(word)
  }
  return { text: text.join(" "), labels, tags }
}
