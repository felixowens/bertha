// Issue labels. Mirrors `normalize_label` and `split_query` in bertha, so what the app
// shows and filters by is what the server stores.

/** An issue has at most this many labels. */
export const LABEL_LIMIT = 10
const LABEL_CHARS = 32

/** "Slow network" → slow-network; null when it can't be a label. */
export function normalizeLabel(raw: string): string | null {
  const label = raw
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .join("-")
  return label && label.length <= LABEL_CHARS && /^[a-z0-9-]+$/.test(label) ? label : null
}

/** Splits `label:x` tokens out of a search: "label:checkout timeout" → ["timeout", ["checkout"]]. */
export function splitLabels(query: string): [string, string[]] {
  const text: string[] = []
  const labels: string[] = []
  for (const word of query.split(/\s+/).filter(Boolean)) {
    const l = word.slice(0, 6).toLowerCase() === "label:" ? word.slice(6) : ""
    if (l) labels.push(normalizeLabel(l) ?? l.toLowerCase())
    else text.push(word)
  }
  return [text.join(" "), labels]
}
