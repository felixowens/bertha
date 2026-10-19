// @bigbertha/sdk/react: an error boundary that reports what it catches with React's
// component stack. Importing it also puts React's version on every event.
//   <ErrorBoundary fallback={<p>Something went wrong.</p>}><App /></ErrorBoundary>

import { Component, type ErrorInfo, type ReactNode, version } from "react"

import { captureException } from "../core/hub.ts"
import { registerVersion } from "../core/versions.ts"

registerVersion("react", version)

export interface FallbackProps {
  error: unknown
  /** The reported event's id, or undefined when it wasn't sent. */
  eventId: string | undefined
  /** Renders the children again. */
  reset: () => void
}

export interface ErrorBoundaryProps {
  children?: ReactNode
  /** Shown in place of the children after an error. Nothing by default. */
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode)
  /** Called after the error is reported. */
  onError?: (error: unknown, componentStack: string | undefined, eventId: string | undefined) => void
  /** Tags on the reported event, e.g. which part of the page this boundary wraps. */
  tags?: Record<string, string>
}

interface State {
  caught: boolean
  error: unknown
  eventId: string | undefined
}

const CLEAR: State = { caught: false, error: undefined, eventId: undefined }

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = CLEAR

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { caught: true, error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? undefined
    const eventId = captureException(error, {
      mechanism: { handler: "ErrorBoundary", handled: true },
      componentStack,
      tags: this.props.tags,
    })
    this.setState({ eventId })
    this.props.onError?.(error, componentStack, eventId)
  }

  reset = (): void => this.setState(CLEAR)

  override render(): ReactNode {
    if (!this.state.caught) return this.props.children
    const f = this.props.fallback
    if (typeof f === "function") return f({ error: this.state.error, eventId: this.state.eventId, reset: this.reset })
    return f ?? null
  }
}
