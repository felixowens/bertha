import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCw } from "lucide-react"
import { captureException } from "../../../sdk/src/core/hub.ts"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/states"

/**
 * Catches a page that throws while rendering, or whose code didn't arrive, so the
 * rest of bertha stays usable. Reports it to bertha's own project when that's set up.
 * Keyed by path where it's used, so the next page starts clean.
 */
export class PageError extends Component<{ children: ReactNode; className?: string }, { caught: boolean }> {
  override state = { caught: false }

  static getDerivedStateFromError() {
    return { caught: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(error, {
      mechanism: { handler: "ErrorBoundary", handled: true },
      componentStack: info.componentStack ?? undefined,
    })
  }

  override render() {
    if (!this.state.caught) return this.props.children
    return (
      <EmptyState
        className={this.props.className ?? "p-10"}
        cells="void"
        title="This page didn't load."
        action={
          <Button variant="outline" size="sm" onClick={() => location.reload()}>
            <RotateCw /> Reload
          </Button>
        }
      >
        bertha may have just been updated. Reload to get the new version.
      </EmptyState>
    )
  }
}
