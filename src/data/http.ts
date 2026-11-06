import type { Backend, IssueChange, LiveListener } from "../contract/actions"
import type { IssueStatus, IssueSummary, LiveEvent } from "../contract/domain"
import { routes, type Route } from "../api/routes.ts"

/**
 * `Backend` over bertha's HTTP API (`/api/v1`). Reads return the data or throw; a
 * missing detail comes back as `null`. Mutations return the server's `Result` as-is.
 */

const BASE = "/api/v1"

/** Pages that work signed out: a 401 there is not a reason to leave. */
const SIGNED_OUT_PAGES = ["/sign-in", "/invite/"]

class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function toSignIn() {
  const { pathname, search } = window.location
  if (SIGNED_OUT_PAGES.some((p) => pathname.startsWith(p))) return
  const next = encodeURIComponent(pathname + search)
  window.location.assign(`/sign-in?next=${next}`)
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json", "X-Bertha": "1" } : {}),
      },
      body: method === "POST" ? JSON.stringify(body ?? null) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach bertha. Check your connection and try again.")
  }
  if (res.ok) return (await res.json()) as T
  if (res.status === 401) toSignIn()
  const message = await res
    .json()
    .then((b: { error?: string }) => b.error)
    .catch(() => undefined)
  throw new ApiError(res.status, message ?? `bertha answered ${res.status}. Try again.`)
}

const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body)
const call = <Reply>(route: Route<Reply>) => request<Reply>(route.method, route.path, route.body)

/** The requests that are nothing but their route. `contract-check.ts` proves each route's reply. */
function plainRequests() {
  const each = Object.entries(routes).map(([method, route]) => [method, (...args: unknown[]) => call((route as (...a: unknown[]) => Route<unknown>)(...args))])
  return Object.fromEntries(each) as unknown as Omit<Backend, "subscribe">
}

export function createHttpBackend(): Backend {
  /**
   * The last state of each issue this tab saw. Sent with `updateIssues` so the server
   * can answer `conflict` when someone else triaged an issue in the meantime.
   */
  const seen = new Map<string, { status: IssueStatus; assigneeId: string | null }>()
  const remember = (issues: Pick<IssueSummary, "id" | "status" | "assignee">[]) => {
    for (const i of issues) seen.set(i.id, { status: i.status, assigneeId: i.assignee?.id ?? null })
  }

  return {
    ...plainRequests(),

    listIssues: async (filter) => {
      const list = await call(routes.listIssues(filter))
      remember(list.issues)
      return list
    },
    getIssue: async (issueId) => {
      const detail = await call(routes.getIssue(issueId))
      if (detail) remember([detail.issue])
      return detail
    },
    updateIssues: async (issueIds, change: IssueChange) => {
      const known = issueIds.flatMap((id) => {
        const s = seen.get(id)
        return s ? [{ id, ...s }] : []
      })
      const result = await call(routes.updateIssues(issueIds, change, known.length === issueIds.length ? known : undefined))
      if (result.ok) remember(result.value)
      else if (result.failure === "conflict") for (const id of issueIds) seen.delete(id)
      return result
    },
    signIn: (email) => {
      // Sign-in carries `?next=` from the page that sent the person here.
      const next = new URLSearchParams(window.location.search).get("next") ?? undefined
      return call(routes.signIn(email, next))
    },

    subscribe: liveStream,
  }
}

/**
 * Change notices from `GET /api/v1/live` (server-sent events). EventSource retries a
 * dropped connection by itself; when it gives up (signed out, or the server refused),
 * this tries again, slower each time. The first open after a gap reports a resync.
 */
function liveStream(listener: LiveListener): () => void {
  let source: EventSource | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let failures = 0
  let missed = false

  const connect = () => {
    listener.status("connecting")
    const es = new EventSource(`${BASE}/live`, { withCredentials: true })
    source = es
    es.onopen = () => {
      failures = 0
      listener.status("open")
      if (missed) listener.event({ kind: "resync" })
      missed = false
    }
    es.onmessage = (m: MessageEvent<string>) => {
      try {
        listener.event(JSON.parse(m.data) as LiveEvent)
      } catch {
        listener.event({ kind: "resync" })
      }
    }
    es.onerror = () => {
      missed = true
      if (es.readyState === EventSource.CONNECTING) return listener.status("connecting")
      es.close()
      source = null
      listener.status("down")
      failures++
      const wait = Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5))
      retry = setTimeout(() => {
        retry = null
        connect()
      }, wait)
    }
  }
  connect()

  return () => {
    source?.close()
    source = null
    if (retry) clearTimeout(retry)
    retry = null
  }
}

/** Ends the session. Not part of `Backend`: the prototype had no sign-out. */
export async function signOut(): Promise<void> {
  await post("/sign-out")
  window.location.assign("/sign-in")
}
