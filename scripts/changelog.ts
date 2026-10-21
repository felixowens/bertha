// CHANGELOG.md: what each release changed, for the people running bertha and using its SDKs.
//
//   node scripts/changelog.ts check [X.Y.Z] [--rev REV]
//                     the file is well formed; with a version, that it has a section with
//                     at least one entry (at REV, default the working tree). The release
//                     gate runs it, so a release can't go out without notes.
//   node scripts/changelog.ts release X.Y.Z [--date YYYY-MM-DD]
//                     moves Unreleased under a new "## X.Y.Z · date" heading. A final
//                     release takes in its prereleases' sections. scripts/version.sh set
//                     runs it.
//   node scripts/changelog.ts notes X.Y.Z
//                     that version's section as markdown, for its GitHub release
//
// Node 24 strips the types.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Each version's groups, in this order. A group appears only when it has entries. */
export const GROUPS = ["Upgrading", "bertha", "Agents", "JavaScript SDK", "Rust SDK", "Running bertha"] as const
type Group = (typeof GROUPS)[number]

const REPO = "https://github.com/felixowens/bertha"
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/
const HEADING = /^## (Unreleased|(\S+) · (\d{4}-\d{2}-\d{2}))$/

export type Section = {
  /** null for Unreleased. */
  version: string | null
  date: string | null
  /** Text between the heading and the first group, e.g. a one-line summary. */
  intro: string
  groups: Map<Group, string>
}
export type Changelog = { head: string; sections: Section[] }

export function parse(text: string): Changelog {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const problems: string[] = []
  const sections: Section[] = []
  const head: string[] = []
  let section: Section | null = null
  let group: Group | null = null
  let buf: string[] = []
  // Sections whose heading is wrong; they're reported once, not again as a second Unreleased.
  const bad = new Set<Section>()
  const flush = () => {
    if (!section) return
    const body = buf.join("\n").trim()
    if (group) section.groups.set(group, body)
    else section.intro = body
    buf = []
  }
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      flush()
      const m = HEADING.exec(line)
      if (!m) problems.push(`Line ${i + 1}: "${line}" should be "## Unreleased" or "## 1.2.3 · 2026-10-22".`)
      else if (m[2] && !VERSION.test(m[2])) problems.push(`Line ${i + 1}: ${m[2]} isn't a version.`)
      section = { version: m?.[2] ?? null, date: m?.[3] ?? null, intro: "", groups: new Map() }
      sections.push(section)
      if (!m || (m[2] && !VERSION.test(m[2]))) bad.add(section)
      group = null
    } else if (line.startsWith("### ")) {
      flush()
      const name = line.slice(4).trim()
      if (!section) problems.push(`Line ${i + 1}: "${name}" comes before any version.`)
      else if (!(GROUPS as readonly string[]).includes(name))
        problems.push(`Line ${i + 1}: "${name}" isn't a group. Use one of: ${GROUPS.join(", ")}.`)
      else if (section.groups.has(name as Group)) problems.push(`Line ${i + 1}: "${name}" appears twice in one version.`)
      group = (GROUPS as readonly string[]).includes(name) ? (name as Group) : null
    } else if (section) buf.push(line)
    else head.push(line)
  })
  flush()

  const unreleased = sections.filter((s) => !s.version && !bad.has(s))
  if (unreleased.length !== 1 || sections[0]?.version) problems.push("There should be one \"## Unreleased\", first.")
  const seen = new Set<string>()
  let prev: Section | null = null
  for (const s of sections) {
    if (!s.version || bad.has(s)) continue
    if (seen.has(s.version)) problems.push(`${s.version} appears twice.`)
    seen.add(s.version)
    if (prev && compare(prev.version!, s.version) <= 0) problems.push(`${s.version} should come below ${prev.version}: newest first.`)
    const order = [...s.groups.keys()].map((g) => GROUPS.indexOf(g))
    if (order.some((n, i) => i > 0 && n < order[i - 1]!)) problems.push(`${s.version}: put the groups in this order: ${GROUPS.join(", ")}.`)
    prev = s
  }
  if (problems.length) throw new ChangelogError(problems)
  return { head: head.join("\n").trim(), sections }
}

export class ChangelogError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`CHANGELOG.md:\n${problems.map((p) => `  ${p}`).join("\n")}`)
    this.problems = problems
  }
}

export function render(c: Changelog): string {
  const out = [c.head, ""]
  for (const s of c.sections) {
    out.push(s.version ? `## ${s.version} · ${s.date}` : "## Unreleased", "")
    if (s.intro) out.push(s.intro, "")
    for (const g of GROUPS) {
      const body = s.groups.get(g)
      if (body) out.push(`### ${g}`, "", body, "")
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"
}

const isEmpty = (s: Section) => !s.intro && [...s.groups.values()].every((b) => !b)

/** Semver order, with a prerelease below its release. */
export function compare(a: string, b: string): number {
  const [ma, pa] = split(a)
  const [mb, pb] = split(b)
  for (let i = 0; i < 3; i++) if (ma[i] !== mb[i]) return ma[i]! - mb[i]!
  if (pa === pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  return pa.localeCompare(pb, "en", { numeric: true })
}
const split = (v: string): [number[], string] => {
  const [main, ...pre] = v.split("-")
  return [main!.split(".").map(Number), pre.join("-")]
}

/** Moves Unreleased under `version`. Already released: unchanged. */
export function release(c: Changelog, version: string, date: string): Changelog {
  if (!VERSION.test(version)) throw new ChangelogError([`${version} isn't a version, e.g. 0.2.0.`])
  if (c.sections.some((s) => s.version === version)) return c
  const [unreleased, ...rest] = c.sections
  const newest = rest[0]?.version
  if (newest && compare(newest, version) >= 0) throw new ChangelogError([`${version} isn't newer than ${newest}.`])
  // A final release covers everything since the last final one, so its prereleases fold in.
  const pre = version.includes("-") ? [] : rest.filter((s) => s.version!.startsWith(`${version}-`))
  const parts = [unreleased!, ...pre]
  const merged: Section = { version, date, intro: parts.map((s) => s.intro).filter(Boolean).join("\n\n"), groups: new Map() }
  for (const g of GROUPS) {
    const body = parts.map((s) => s.groups.get(g)).filter(Boolean).join("\n")
    if (body) merged.groups.set(g, body)
  }
  if (isEmpty(merged))
    throw new ChangelogError([`Nothing under "## Unreleased" for ${version}. Write what changed for the people using it, then release.`])
  return {
    head: c.head,
    sections: [{ version: null, date: null, intro: "", groups: new Map() }, merged, ...rest.filter((s) => !pre.includes(s))],
  }
}

/**
 * The file wraps lines; GitHub's release page turns each line break into a break, so each
 * paragraph and list item becomes one line again. Code blocks stay as they are.
 */
export function unwrap(body: string): string {
  const out: string[] = []
  let code = false
  for (const line of body.split("\n")) {
    if (line.trimStart().startsWith("```")) code = !code
    const prev = out.at(-1)
    const continues = !code && line.trim() && !/^\s*([-*+] |\d+\. |#|>|```|\|)/.test(line)
    if (continues && prev?.trim() && !prev.trimStart().startsWith("```")) out[out.length - 1] = `${prev} ${line.trim()}`
    else out.push(line)
  }
  return out.join("\n")
}

/** One version's notes, as its GitHub release shows them. */
export function notes(c: Changelog, version: string): string {
  const i = c.sections.findIndex((s) => s.version === version)
  const s = c.sections[i]
  if (!s || isEmpty(s)) throw new ChangelogError([`No entries for ${version}.`])
  const out: string[] = []
  if (s.intro) out.push(unwrap(s.intro), "")
  for (const g of GROUPS) {
    const body = s.groups.get(g)
    if (body) out.push(`### ${g}`, "", unwrap(body), "")
  }
  const previous = c.sections.slice(i + 1).find((p) => p.version && !p.version.includes("-"))?.version
  if (previous) out.push(`[Every commit since ${previous}](${REPO}/compare/v${previous}...v${version})`)
  return out.join("\n").trimEnd() + "\n"
}

function main(args: string[]) {
  const file = fileURLToPath(new URL("../CHANGELOG.md", import.meta.url))
  const [cmd, ...rest] = args
  const flag = (name: string) => {
    const i = rest.indexOf(name)
    return i < 0 ? undefined : rest.splice(i, 2)[1]
  }
  const rev = flag("--rev")
  const date = flag("--date") ?? new Date().toISOString().slice(0, 10)
  const version = rest[0]?.replace(/^v/, "")
  const read = () =>
    rev ? execFileSync("git", ["show", `${rev}:CHANGELOG.md`], { encoding: "utf8" }) : readFileSync(file, "utf8")
  switch (cmd) {
    case "check": {
      const c = parse(read())
      if (version) notes(c, version)
      return
    }
    case "release": {
      if (!version) throw new ChangelogError(["Give the version, e.g. 0.2.0."])
      writeFileSync(file, render(release(parse(read()), version, date)))
      return
    }
    case "notes": {
      if (!version) throw new ChangelogError(["Give the version, e.g. 0.2.0."])
      process.stdout.write(notes(parse(read()), version))
      return
    }
    default:
      throw new ChangelogError(["Use: node scripts/changelog.ts check [X.Y.Z] [--rev REV] | release X.Y.Z [--date D] | notes X.Y.Z"])
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof ChangelogError ? e.message : e)
    process.exit(1)
  }
}
