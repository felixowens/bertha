// Finds links in text people and apps wrote, and names them the way you'd say them:
// github.com/sundial-dev/kiln-and-clay/pull/42 is "#42" on that project's own issues,
// and "sundial-dev/kiln-and-clay#42" anywhere else. Pure, so it runs outside React too.

/** A repository on a forge we know the URL shapes of. */
export type Repo = { forge: "github" | "gitlab"; origin: string; path: string }

/** What the text around a link is about: the project's repo, and the issue keys that exist. */
export type LinkScope = { repo: Repo | null; keys: string[]; origin: string }

export type LinkKind = "pull" | "issue" | "commit" | "file" | "compare" | "release" | "run" | "repo" | "internal" | "page"

export type Piece = string | { href: string; label: string; kind: LinkKind; title: string }

export function parseRepo(url: string | null | undefined): Repo | null {
  const u = toUrl(url)
  if (!u) return null
  const forge = forgeOf(u.hostname)
  if (!forge) return null
  const parts = segments(u)
  if (forge === "github") return parts.length >= 2 ? { forge, origin: u.origin, path: `${parts[0]}/${parts[1]}` } : null
  const end = parts.indexOf("-")
  const path = (end === -1 ? parts : parts.slice(0, end)).join("/")
  return path.includes("/") ? { forge, origin: u.origin, path } : null
}

/**
 * Splits text into plain runs and links. `refs` also links the shorthand people write in
 * notes and commit messages (#42, owner/repo#42, repo#42, a commit sha, KILN-4F); event
 * data leaves it off, since "#3" in an error message is rarely an issue.
 */
export function linkify(text: string, scope: LinkScope, opts: { refs?: boolean; pretty?: boolean } = {}): Piece[] {
  const pretty = opts.pretty ?? true
  const alternatives = [String.raw`https?://[^\s<>"'\`]+`]
  if (opts.refs) {
    alternatives.push(String.raw`(?<![\w/.#-])(?:[\w.-]+/)?[\w.-]+#\d+\b`, String.raw`(?<![\w/.#-])#\d+\b`, String.raw`(?<![\w/.@-])\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b`)
    if (scope.keys.length) alternatives.push(String.raw`\b(?:${scope.keys.map(escape).join("|")})-[0-9A-Z]+\b`)
  }
  const re = new RegExp(alternatives.join("|"), "g")
  const out: Piece[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    let raw = m[0]
    if (raw.startsWith("http")) raw = trimUrl(raw)
    const link = raw.startsWith("http") ? fromUrl(raw, scope, pretty) : fromRef(raw, scope)
    if (!link) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(link)
    last = m.index + raw.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function fromUrl(raw: string, scope: LinkScope, pretty: boolean): Exclude<Piece, string> | null {
  const u = toUrl(raw)
  if (!u) return null
  if (u.origin === scope.origin) return internal(u.pathname + u.search + u.hash, pretty ? u.pathname + u.search : raw)
  if (!pretty) return { href: u.href, label: raw, kind: "page", title: u.href }
  const forge = forgeOf(u.hostname) ?? (scope.repo && u.origin === scope.repo.origin ? scope.repo.forge : null)
  const named = forge && (forge === "github" ? github(u, scope) : gitlab(u, scope))
  if (named) return { href: u.href, title: u.href, ...named }
  return { href: u.href, label: shorten(u), kind: "page", title: u.href }
}

function internal(path: string, label: string): Exclude<Piece, string> {
  return { href: path, label, kind: "internal", title: path }
}

function fromRef(raw: string, scope: LinkScope): Exclude<Piece, string> | null {
  const repo = scope.repo
  const hash = raw.indexOf("#")
  if (hash !== -1) {
    const n = raw.slice(hash + 1)
    const named = raw.slice(0, hash)
    let target: Repo | null = repo
    if (named.includes("/")) target = repo && named.toLowerCase() === repo.path.toLowerCase() ? repo : { forge: "github", origin: "https://github.com", path: named }
    else if (named) target = repo && named.toLowerCase() === repo.path.split("/").pop()!.toLowerCase() ? repo : null
    if (!target) return null
    const href = target.forge === "github" ? `${target.origin}/${target.path}/issues/${n}` : `${target.origin}/${target.path}/-/issues/${n}`
    return { href, label: raw, kind: "issue", title: href }
  }
  if (/^[0-9a-f]+$/.test(raw)) {
    if (!repo) return null
    const href = repo.forge === "github" ? `${repo.origin}/${repo.path}/commit/${raw}` : `${repo.origin}/${repo.path}/-/commit/${raw}`
    return { href, label: raw.slice(0, 7), kind: "commit", title: href }
  }
  return internal(`/issues/${raw}`, raw)
}

type Named = { label: string; kind: LinkKind }

function github(u: URL, scope: LinkScope): Named | null {
  const [owner, name, kind, ...rest] = segments(u)
  if (!owner || !name) return null
  return forgePath(`${owner}/${name}`, kind, rest, u, scope, { pull: "pull", issues: "issues", discussions: "issues", runs: "actions" })
}

function gitlab(u: URL, scope: LinkScope): Named | null {
  const parts = segments(u)
  const end = parts.indexOf("-")
  if (end < 2) return parts.length >= 2 && end === -1 ? { label: parts.join("/"), kind: "repo" } : null
  const [kind, ...rest] = parts.slice(end + 1)
  return forgePath(parts.slice(0, end).join("/"), kind, rest, u, scope, { merge_requests: "pull", issues: "issues", runs: "pipelines" })
}

function forgePath(path: string, kind: string | undefined, rest: string[], u: URL, scope: LinkScope, words: Record<string, string>): Named | null {
  const own = scope.repo !== null && scope.repo.path.toLowerCase() === path.toLowerCase()
  const prefix = own ? "" : path
  const pullMark = words.merge_requests ? "!" : "#"
  if (!kind) return { label: path, kind: "repo" }
  const at = (ref: string) => (/^[0-9a-f]{8,64}$/.test(ref) ? ref.slice(0, 7) : ref)
  if ((words[kind] === "pull" || words[kind] === "issues") && /^\d+$/.test(rest[0] ?? "")) {
    const pull = words[kind] === "pull"
    const label = `${prefix}${pull ? pullMark : "#"}${rest[0]}`
    if (pull && rest[1] === "commits" && rest[2]) return { label: `${label} ${at(rest[2])}`, kind: "commit" }
    return { label: u.hash.startsWith("#issuecomment") || u.hash.startsWith("#note_") ? `${label} comment` : label, kind: pull ? "pull" : "issue" }
  }
  if (kind === "commit" && rest[0]) return { label: own ? at(rest[0]) : `${path}@${at(rest[0])}`, kind: "commit" }
  if ((kind === "blob" || kind === "tree") && rest[0]) {
    const file = rest.slice(1).join("/")
    if (!file) return { label: `${path}@${at(rest[0])}`, kind: "repo" }
    const lines = /^#L(\d+)(?:C\d+)?(?:-L?(\d+))?/.exec(u.hash)
    const where = lines ? `:${lines[1]}${lines[2] ? `-${lines[2]}` : ""}` : ""
    return { label: `${own ? "" : `${path}/`}${file}${where}`, kind: "file" }
  }
  if (kind === "compare" && rest[0]) return { label: `${prefix}${prefix ? " " : ""}${rest.join("/").split("...").map(at).join("...")}`, kind: "compare" }
  if (kind === "releases" && rest[0] === "tag" && rest[1]) return { label: `${path} ${rest.slice(1).join("/")}`, kind: "release" }
  if (kind === "actions" && rest[0] === "runs" && rest[1]) return { label: `${prefix}${prefix ? " " : ""}run ${rest[1]}`, kind: "run" }
  if (kind === "pipelines" && rest[0]) return { label: `${prefix}${prefix ? " " : ""}pipeline ${rest[0]}`, kind: "run" }
  return { label: [path, kind, ...rest].join("/"), kind: "page" }
}

/** Trailing punctuation belongs to the sentence; a close paren only when it opened none. */
function trimUrl(raw: string): string {
  let s = raw.replace(/[.,;:!?'"*_]+$/, "")
  while (s.endsWith(")") && count(s, "(") < count(s, ")")) s = s.slice(0, -1).replace(/[.,;:!?'"*_]+$/, "")
  return s
}

/** host/path without the scheme, www or a trailing slash; long ones lose their middle. */
function shorten(u: URL): string {
  const s = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")}${u.search}`
  return s.length > 64 ? `${s.slice(0, 40)}…${s.slice(-20)}` : s
}

function toUrl(s: string | null | undefined): URL | null {
  if (!s) return null
  try {
    const u = new URL(s)
    return u.protocol === "https:" || u.protocol === "http:" ? u : null
  } catch {
    return null
  }
}

const forgeOf = (host: string): Repo["forge"] | null => (host === "github.com" || host === "www.github.com" ? "github" : host === "gitlab.com" ? "gitlab" : null)
const segments = (u: URL) => u.pathname.split("/").filter(Boolean).map(decodeURIComponent)
const count = (s: string, c: string) => s.split(c).length - 1
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
