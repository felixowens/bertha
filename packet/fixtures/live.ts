import type { LiveEvent } from "../contract/domain"

// Change notices replayed by `params.live = "replay"` (see scenarios.ts), each so many
// milliseconds after the page subscribes: a deploy's fallout arriving while you watch.
export const liveReplay: { afterMs: number; event: LiveEvent }[] = [
  { afterMs: 3_000, event: { kind: "ingested", projectId: "p-kiln", events: 6, newIssues: ["i-hydration"], regressed: [], touched: ["i-cart-map", "i-noisy"] } },
  { afterMs: 5_000, event: { kind: "ingested", projectId: "p-harbour", events: 2, newIssues: [], regressed: ["i-8"], touched: [] } },
  { afterMs: 7_000, event: { kind: "ingested", projectId: "p-kiln", events: 1, newIssues: ["i-4"], regressed: [], touched: [] } },
  { afterMs: 9_000, event: { kind: "monitor", projectId: "p-harbour", monitorId: "mon-harbour", state: "up" } },
  { afterMs: 11_000, event: { kind: "issuesChanged", projectId: "p-moss", issueIds: ["i-longest"] } },
]
