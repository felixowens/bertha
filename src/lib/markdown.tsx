import type { ReactNode } from "react"
import { LinkPiece, Linkified } from "@/components/ui/linkify"
import { linkify, type LinkScope } from "@/lib/links"
import { useLinkScope } from "@/components/ui/linkify"
import { Link } from "@/lib/router"

/**
 * A deliberately small markdown renderer for issue notes (contract: `Prose` = markdown).
 * Paragraphs, bullet lists, `code`, **bold**, fenced code and links. No HTML passthrough.
 * Bare URLs and shorthand like #42 or KILN-4F link themselves (`Linkified`).
 */
function inline(text: string, key: string, scope: LinkScope, repoUrl: string | null): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Linkified key={`${key}-t${n}`} text={text.slice(last, m.index)} repoUrl={repoUrl} />)
    const t = m[0]
    const k = `${key}-${n++}`
    if (t.startsWith("`")) out.push(<code key={k} className="rounded-[3px] bg-raised px-1 py-px font-mono text-[0.92em] text-foreground">{t.slice(1, -1)}</code>)
    else if (t.startsWith("**")) out.push(<strong key={k} className="font-medium text-foreground">{t.slice(2, -2)}</strong>)
    else {
      const [, label, url] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!
      const named = label === url ? linkify(url, scope) : []
      const cls = "text-foreground underline decoration-border underline-offset-4 transition-[text-decoration-color] duration-150 ease-smooth hover:decoration-foreground"
      if (named.length === 1 && typeof named[0] !== "string") out.push(<LinkPiece key={k} piece={named[0]} />)
      else if (url.startsWith("/"))
        out.push(
          <Link key={k} to={url} className={cls}>
            {label}
          </Link>,
        )
      else
        out.push(
          <a key={k} href={/^https?:/.test(url) ? url : "#"} title={url} className={cls} target="_blank" rel="noreferrer noopener">
            {label}
          </a>,
        )
    }
    last = m.index + t.length
  }
  if (last < text.length) out.push(<Linkified key={`${key}-end`} text={text.slice(last)} repoUrl={repoUrl} />)
  return out
}

export function Markdown({ source, repoUrl }: { source: string; repoUrl: string | null }) {
  const scope = useLinkScope(repoUrl)
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r/g, "").split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith("```")) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++])
      i++
      blocks.push(<pre key={i} className="overflow-x-auto rounded-md border border-hairline bg-sidebar p-3 font-mono text-xs text-muted-foreground">{body.join("\n")}</pre>)
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""))
      blocks.push(
        <ul key={i} className="flex list-none flex-col gap-1">
          {items.map((it, k) => (
            <li key={k} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-[1px] bg-faint" />
              <span>{inline(it, `${i}-${k}`, scope, repoUrl)}</span>
            </li>
          ))}
        </ul>,
      )
    } else if (line.trim() === "") i++
    else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !/^\s*[-*] /.test(lines[i])) para.push(lines[i++])
      blocks.push(<p key={i}>{inline(para.join(" "), String(i), scope, repoUrl)}</p>)
    }
  }
  return <div className="flex flex-col gap-2 text-sm text-muted-foreground">{blocks}</div>
}
