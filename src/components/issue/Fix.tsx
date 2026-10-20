import type { FixWatch } from "../../contract/domain"
import { Mono } from "@/components/ui/primitives"
import { version } from "@/lib/format"
import { commitHref, parseRepo, pullHref } from "@/lib/links"

const ext = "text-foreground underline decoration-border underline-offset-4 transition-[text-decoration-color] duration-150 ease-smooth hover:decoration-foreground"

/** "#196" or "abc1234", linked into the repo when bertha knows its forge. */
export function FixRef({ pr, commit, repoUrl }: { pr: number | null; commit: string | null; repoUrl: string | null }) {
  const repo = parseRepo(repoUrl)
  const label = pr !== null ? `#${pr}` : commit ? commit.slice(0, 7) : null
  if (!label) return <>the fix</>
  const href = pr !== null ? pullHref(repo, pr) : commitHref(repo, commit!)
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={ext}>
      <Mono className="text-foreground">{label}</Mono>
    </a>
  ) : (
    <Mono className="text-foreground">{label}</Mono>
  )
}

export function ReleaseRef({ release }: { release: string }) {
  return (
    <Mono className="text-foreground" title={release}>
      {version(release)}
    </Mono>
  )
}

/** Where a fix is on its way to production, as one sentence. */
export function FixStatus({ watch, repoUrl }: { watch: FixWatch; repoUrl: string | null }) {
  const pr = watch.pr !== null ? <FixRef pr={watch.pr} commit={null} repoUrl={repoUrl} /> : null
  const merged = watch.commit ? <FixRef pr={null} commit={watch.commit} repoUrl={repoUrl} /> : null
  switch (watch.state) {
    case "waiting_merge":
      return <>Waiting for {pr ?? "the PR"} to merge.</>
    case "waiting_release":
      return pr && merged ? (
        <>
          {pr} merged as {merged}, waiting for a production release.
        </>
      ) : (
        <>{merged ? <>Waiting for a production release with {merged}.</> : "Waiting for a production release."}</>
      )
    case "shipped":
      return watch.release ? (
        <>
          Shipped in <ReleaseRef release={watch.release} />.
        </>
      ) : (
        <>Shipped.</>
      )
    case "closed":
      return <>{pr ?? "The PR"} was closed without merging.</>
    case "unwatched":
      return <>Not watched. {watch.problem}</>
  }
}
