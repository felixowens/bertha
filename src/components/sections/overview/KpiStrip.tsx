import { Activity, CirclePlus, Radio, RotateCcw } from "lucide-react"
import type { Kpi, TimeRange } from "../../../contract/domain"
import { CellBars } from "@/components/charts/cells"
import { Stat, StatStrip } from "@/components/ui/stat"
import { Mono, type Tone } from "@/components/ui/primitives"
import { delta, num } from "@/lib/format"

/** Rolling windows, not calendar days: "yesterday" would read as the date. */
const PERIOD: Record<TimeRange, string> = { "24h": "the 24h before", "7d": "the 7 days before", "30d": "the 30 days before" }

/** Whether "up" is good or bad depends on the measure. */
function tone(dir: "up" | "down" | "flat", upIs: Tone): Tone {
  if (dir === "flat") return "quiet"
  return dir === "up" ? upIs : upIs === "ok" ? "danger" : "ok"
}

/** Uptime lives in 99.x; chart the movement, not the distance from zero. */
const relative = (t: number[]) => {
  const lo = Math.min(...t)
  return t.map((v) => v - lo + 0.02)
}

export function KpiStrip({ kpis, range }: { kpis: Record<"events" | "newIssues" | "regressions" | "uptime", Kpi>; range: TimeRange }) {
  // The previous count, so a flat "±0%" can't read as nothing.
  const vs = (k: Kpi) => (
    <>
      vs <Mono>{num(k.previous)}</Mono> {PERIOD[range]}
    </>
  )
  const ev = delta(kpis.events.value, kpis.events.previous)
  const ni = delta(kpis.newIssues.value, kpis.newIssues.previous)
  const rg = delta(kpis.regressions.value, kpis.regressions.previous)
  const up = kpis.uptime.value - kpis.uptime.previous
  const upDir = Math.abs(up) < 0.01 ? "flat" : up > 0 ? "up" : "down"
  return (
    <StatStrip>
      <Stat
        icon={Activity}
        label="Events"
        value={num(kpis.events.value)}
        delta={ev.text}
        deltaTone={tone(ev.dir, "warn")}
        chart={<CellBars values={kpis.events.trend} label="Events per bucket" />}
        hint={vs(kpis.events)}
      />
      <Stat
        icon={CirclePlus}
        label="New issues"
        value={num(kpis.newIssues.value)}
        delta={ni.text}
        deltaTone={tone(ni.dir, "warn")}
        chart={<CellBars values={kpis.newIssues.trend} label="New issues per bucket" />}
        hint={vs(kpis.newIssues)}
      />
      <Stat
        icon={RotateCcw}
        label="Regressions"
        value={num(kpis.regressions.value)}
        delta={rg.text}
        deltaTone={tone(rg.dir, "danger")}
        chart={<CellBars values={kpis.regressions.trend} tone={kpis.regressions.value > 0 ? "danger" : "quiet"} label="Regressions per bucket" />}
        hint={vs(kpis.regressions)}
      />
      <Stat
        icon={Radio}
        label="Uptime"
        value={kpis.uptime.value.toFixed(2)}
        unit="%"
        delta={upDir === "flat" ? "±0pt" : `${up > 0 ? "+" : "−"}${Math.abs(up).toFixed(2)}pt`}
        deltaTone={tone(upDir, "ok")}
        chart={<CellBars values={relative(kpis.uptime.trend)} label="Uptime per bucket" />}
        hint="across all monitors"
      />
    </StatStrip>
  )
}
