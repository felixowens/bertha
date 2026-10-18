import { useState } from "react"
import type { AcceptInvitePage } from "../contract/pages"
import { backend, usesFixtures } from "@/data/backend"
import { usePageLoadable, type Ready } from "@/data/useLoadable"
import { Standalone } from "@/components/standalone/Standalone"
import { Button } from "@/components/ui/button"
import { LoadingCells, InlineError } from "@/components/ui/states"
import { Mono, Square } from "@/components/ui/primitives"
import { Link } from "@/lib/router"
import { plural } from "@/lib/format"

type Data = Ready<AcceptInvitePage>
type Outcome = { s: "idle" | "busy" | "done" } | { s: "failed"; kind: "invite_expired" | "invite_used"; message: string }

const linkClass = "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"

function Invitation({ data, token }: { data: Data; token: string }) {
  const known = data.status === "expired" ? "invite_expired" : data.status === "used" ? "invite_used" : null
  const [o, setO] = useState<Outcome>(known ? { s: "failed", kind: known, message: known === "invite_expired" ? "This invitation expired. Invitations last 7 days." : "This invitation was already accepted." } : { s: "idle" })
  const accept = async () => {
    setO({ s: "busy" })
    const r = await backend.acceptInvite(token)
    setO(r.ok ? { s: "done" } : { s: "failed", kind: r.failure, message: r.message })
  }
  const from = data.invitedBy.name

  if (o.s === "done")
    return (
      <div role="status">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Square tone="ok" /> Access granted
        </div>
        <h1 className="mt-3 text-xl font-medium tracking-[-0.01em] text-foreground">You're in.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can see and triage {data.projectNames.length === 1 ? "one project" : plural(data.projectNames.length, "project")}. {from} keeps alerts and team settings.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link to={usesFixtures ? "/?scenario=overview-collaborator" : "/"}>Open bertha</Link>
        </Button>
      </div>
    )

  return (
    <div>
      <h1 className="text-xl font-medium tracking-[-0.01em] text-foreground">{from} invited you to triage errors.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        bertha collects the errors from {from}'s apps. You'll see {data.projectNames.length === 1 ? "this project" : "these projects"} and nothing else.
      </p>
      <ul className="mt-6 flex flex-col gap-px overflow-hidden rounded-lg border border-hairline">
        {data.projectNames.map((n) => (
          <li key={n} className="bg-card px-3.5 py-3 text-sm leading-snug text-foreground">
            {n}
          </li>
        ))}
      </ul>
      <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-faint">For</dt>
        <dd className="truncate">
          <Mono className="text-muted-foreground">{data.email}</Mono>
        </dd>
        <dt className="text-faint">From</dt>
        <dd className="truncate text-muted-foreground">
          {from} <Mono className="text-faint">{data.invitedBy.email}</Mono>
        </dd>
      </dl>

      {o.s === "failed" ? (
        <div className="mt-6 rounded-md border border-warn/30 bg-warn/5 px-3.5 py-3">
          <p role="alert" className="flex items-start gap-2 text-sm text-foreground">
            <Square tone="warn" className="mt-[6px]" />
            {o.message}
          </p>
          <p className="mt-1.5 pl-4 text-sm text-muted-foreground">
            {o.kind === "invite_expired" ? (
              <>
                Ask {from} to send a new one. Write to <Mono className="text-foreground">{data.invitedBy.email}</Mono>.
              </>
            ) : (
              <>
                If that was you on another device, just{" "}
                <Link to="/sign-in" className={linkClass}>
                  sign in
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <Button className="mt-6 w-full" disabled={o.s === "busy"} onClick={() => void accept()}>
          {o.s === "busy" ? "Accepting…" : "Accept invitation"}
        </Button>
      )}
    </div>
  )
}

export function AcceptInvite({ token }: { token: string }) {
  const { state, reload } = usePageLoadable<Data>("/invite/:token", () => backend.getInvite(token), [token])
  return (
    <Standalone>
      {state.status === "loading" ? (
        <LoadingCells label="Checking the invitation" />
      ) : state.status === "error" ? (
        <div>
          <InlineError>{state.message}</InlineError>
          <Button variant="outline" className="mt-4" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : state.status === "empty" ? (
        <div>
          <h1 className="text-xl font-medium tracking-[-0.01em] text-foreground">That link doesn't match an invitation.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been cut short by your email app. Open it again from the email, or{" "}
            <Link to="/sign-in" className={linkClass}>
              sign in
            </Link>{" "}
            if you already have access.
          </p>
        </div>
      ) : (
        <Invitation data={state.data} token={token} />
      )}
    </Standalone>
  )
}
