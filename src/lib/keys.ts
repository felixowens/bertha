// Project keys: the prefix of every issue id (KILN-4F). Mirrors `key_from_name` and
// `unique_key` in bertha-db, so the suggestion is what the server would pick.

/** "Kiln & Clay" → KILN; "st aidan's newsletter" → SAN; "2048 clone" → P204. */
export function keyFromName(name: string): string {
  const words = name
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
  const first = words[0] ?? "PROJ"
  const key = (
    first.length >= 3 || words.length < 3
      ? first.slice(0, 4)
      : words
          .map((w) => w[0])
          .slice(0, 4)
          .join("")
  ).toUpperCase()
  return /^\d/.test(key) ? `P${key}` : key
}

/** `KILN`, or `KILN2`, `KILN3`… when the key is taken. */
export function uniqueKey(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) if (!taken.includes(`${base}${n}`)) return `${base}${n}`
}

/** 2–6 capital letters or digits, starting with a letter. */
export const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/
