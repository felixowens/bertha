import type { Release, TagBreakdown, TagKey } from "../../contract/domain"
import { ShareCells } from "@/components/charts/cells"
import { Mono } from "@/components/ui/primitives"
import { compact, num } from "@/lib/format"
import { Link } from "@/lib/router"

/** Values search can find link to the issues that share them; releases go to the release. */
function href(key: TagKey, value: string, projectId: string, releases: Release[]) {
  if (key === "release") {
    const r = releases.find((x) => x.version === value && x.projectId === projectId)
    if (r) return `/releases/${r.id}`
  }
  if (key === "user" || key === "url" || key === "release") return `/issues?${new URLSearchParams({ project: projectId, status: "all", query: value })}`
  return null
}

const LABEL: Record<TagKey, string> = {
  url: "URLs",
  browser: "Browsers",
  os: "Operating systems",
  release: "Releases",
  environment: "Environments",
  user: "Users",
}
const ORDER: TagKey[] = ["user", "url", "browser", "os", "release", "environment"]

/** Who and where: top values per tag as share-of-events cell bars. */
export function Tags({ tags, eventCount, projectId, releases }: { tags: TagBreakdown[]; eventCount: number; projectId: string; releases: Release[] }) {
  const sorted = [...tags].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
  if (!sorted.length) return <p className="text-sm text-faint">No tags reported.</p>
  return (
    <div className="flex flex-col gap-6">
      {sorted.map((t) => {
        const shown = t.values.reduce((s, v) => s + v.count, 0)
        const rest = Math.max(0, eventCount - shown)
        return (
          <div key={t.key}>
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{LABEL[t.key]}</span>
              <Mono className="text-faint">{num(t.distinct)} distinct</Mono>
            </div>
            {t.values.length === 0 && (
              <p className="text-xs text-faint">
                None reported
                {t.key === "user" ? ": the app doesn't send who was affected" : ""}.
              </p>
            )}
            <ul className="flex flex-col gap-1.5">
              {t.values.map((v, i) => {
                const to = href(t.key, v.value, projectId, releases)
                return (
                  <li key={v.value} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                    {to ? (
                      <Link
                        to={to}
                        className="truncate font-mono text-xs text-foreground underline-fade"
                        title={t.key === "release" && to.startsWith("/releases/") ? `Release ${v.value}` : `Issues with ${v.value}`}
                      >
                        {v.value}
                      </Link>
                    ) : (
                      <Mono className="truncate text-xs text-foreground" title={v.value}>
                        {v.value}
                      </Mono>
                    )}
                    <Mono className="text-right text-xs text-faint">{Math.round((v.count / Math.max(eventCount, 1)) * 100)}%</Mono>
                    <div className="col-span-2">
                      <ShareCells share={v.count / Math.max(eventCount, 1)} cells={32} tone={i === 0 ? "fg" : "quiet"} />
                    </div>
                  </li>
                )
              })}
              {t.distinct > t.values.length && rest > 0 && (
                <li className="text-xs text-faint">
                  +{num(t.distinct - t.values.length)} more · <Mono>{compact(rest)}</Mono> events
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
