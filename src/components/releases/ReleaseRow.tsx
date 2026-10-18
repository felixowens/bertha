import type { Release } from "../../contract/domain"
import { Mono, Square } from "@/components/ui/primitives"
import { ago, compact, stamp } from "@/lib/format"
import { envShort } from "@/lib/meaning"
import { Link } from "@/lib/router"

export const RELEASE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(160px,220px)_minmax(0,1fr)_200px_72px] md:gap-x-6"

/** What a deploy did, in one readout: broke things, brought things back, or held. */
export function verdict(r: Release) {
  if (r.newIssues || r.regressedIssues)
    return (
      <span className="flex items-center gap-3">
        {r.newIssues > 0 && (
          <span className="flex items-center gap-1.5 text-warn">
            <Square tone="warn" />
            <Mono>{r.newIssues}</Mono> new
          </span>
        )}
        {r.regressedIssues > 0 && (
          <span className="flex items-center gap-1.5 text-danger">
            <Square tone="danger" />
            <Mono>{r.regressedIssues}</Mono> back
          </span>
        )}
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <Square tone="quiet" />
      {r.quietSinceDeploy ? (
        <>
          held <Mono>{r.quietSinceDeploy}</Mono> {r.quietSinceDeploy === 1 ? "fix" : "fixes"}
        </>
      ) : (
        "nothing new"
      )}
    </span>
  )
}

export function ReleaseRow({ release: r, projectName }: { release: Release; projectName: string }) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      <Link to={`/releases/${r.id}`} className={`${RELEASE_GRID} group px-4 py-3 transition-colors hover:bg-raised/50 md:px-6`}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Mono className="truncate text-sm text-foreground group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">{r.version}</Mono>
            {r.environment !== "production" && <Mono className="shrink-0 rounded-[3px] border border-border px-1 text-2xs text-muted-foreground">{envShort[r.environment]}</Mono>}
          </div>
          <div className="mt-0.5 truncate text-xs text-faint">{projectName}</div>
        </div>
        <div className="col-span-full row-start-2 min-w-0 md:col-span-1 md:row-start-auto">
          {r.commit ? (
            <>
              <div className="truncate text-sm text-muted-foreground">{r.commit.message}</div>
              <div className="mt-0.5 truncate font-mono text-xs text-faint">
                {r.commit.sha.slice(0, 7)} · {r.commit.author}
              </div>
            </>
          ) : (
            <div className="text-sm text-faint">No commit info sent with this deploy</div>
          )}
        </div>
        <div className="col-start-2 row-start-1 flex flex-col items-end gap-0.5 text-xs md:col-start-auto md:row-start-auto md:items-start">
          {verdict(r)}
          <Mono className="text-faint md:hidden">{ago(r.deployedAt)}</Mono>
        </div>
        <div className="hidden text-right md:block">
          <Mono className="block text-sm text-muted-foreground" title={stamp(r.deployedAt)}>
            {ago(r.deployedAt)}
          </Mono>
          <Mono className="block text-xs text-faint">{compact(r.eventCount)} ev</Mono>
        </div>
      </Link>
    </li>
  )
}
