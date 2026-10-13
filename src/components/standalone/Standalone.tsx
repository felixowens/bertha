import type { ReactNode } from "react"
import { Wordmark } from "@/components/shell/Wordmark"

/** Pages reached from outside the app (email links): one dark card on the dotted backdrop. */
export function Standalone({ children, foot }: { children: ReactNode; foot?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-dots px-4 pt-[14vh] pb-10">
      <div className="w-full max-w-[420px] rounded-xl border border-border bg-background p-6 shadow-elegant md:p-8">
        <div className="mb-8">
          <Wordmark />
        </div>
        {children}
      </div>
      {foot && <div className="mt-5 max-w-[420px] text-center text-xs text-backdrop-ink">{foot}</div>}
    </main>
  )
}
