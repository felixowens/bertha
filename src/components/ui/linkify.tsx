import { useContext, type ReactNode } from "react"
import { cn } from "cn"
import { CircleDot, CirclePlay, FileCode, FolderGit2, GitCommitHorizontal, GitCompareArrows, GitPullRequest, Tag, type LucideIcon } from "lucide-react"
import { ShellContext } from "@/components/shell/ShellContext"
import { linkify, parseRepo, type LinkKind, type LinkScope, type Piece } from "@/lib/links"
import { Link } from "@/lib/router"

const icons: Partial<Record<LinkKind, LucideIcon>> = {
  pull: GitPullRequest,
  issue: CircleDot,
  commit: GitCommitHorizontal,
  file: FileCode,
  compare: GitCompareArrows,
  release: Tag,
  run: CirclePlay,
  repo: FolderGit2,
}

/** Links in text about one project: its repo for #42 and shas, every project's key for KILN-4F. */
export function useLinkScope(repoUrl: string | null | undefined): LinkScope {
  const shell = useContext(ShellContext)
  return { repo: parseRepo(repoUrl), keys: shell?.projects.map((p) => p.key) ?? [], origin: window.location.origin }
}

/**
 * Text with its links live. Prose (notes, commit messages) names them and links the
 * shorthand too; event data (`exact`) keeps every character as the app sent it.
 */
export function Linkified({ text, repoUrl, exact }: { text: string; repoUrl: string | null; exact?: boolean }) {
  const scope = useLinkScope(repoUrl)
  const out: ReactNode[] = []
  for (const [i, p] of linkify(text, scope, { refs: !exact, pretty: !exact }).entries()) {
    if (typeof p === "string") {
      out.push(p)
      continue
    }
    const link = <LinkPiece key={i} piece={p} exact={exact} />
    // An opening bracket stays on the line with the link after it.
    const before = out.at(-1)
    if (typeof before === "string" && /[([“"']$/.test(before)) {
      out[out.length - 1] = before.slice(0, -1)
      out.push(
        <span key={i} className="whitespace-nowrap">
          {before.slice(-1)}
          {link}
        </span>,
      )
    } else out.push(link)
  }
  return <>{out}</>
}

export function LinkPiece({ piece, exact }: { piece: Exclude<Piece, string>; exact?: boolean }) {
  const Icon = exact ? undefined : icons[piece.kind]
  const className = cn(
    "underline underline-offset-4 transition-[color,text-decoration-color] duration-150 ease-smooth",
    exact ? "decoration-hairline hover:text-foreground hover:decoration-border" : "font-mono text-[0.92em] text-foreground decoration-border hover:decoration-foreground",
    Icon && "whitespace-nowrap",
  )
  const body = (
    <>
      {Icon && <Icon aria-hidden className="mr-1 inline size-3 -translate-y-px text-faint" />}
      {piece.label}
    </>
  )
  if (piece.kind === "internal")
    return (
      <Link to={piece.href} title={piece.title} className={className}>
        {body}
      </Link>
    )
  return (
    <a href={piece.href} title={piece.title} target="_blank" rel="noreferrer noopener" className={cn(className, "break-words")}>
      {body}
    </a>
  )
}
