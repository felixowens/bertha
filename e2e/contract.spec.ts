// Calls every `Backend` method on a real bertha through the HTTP adapter the app uses,
// and holds every reply to `src/contract`. Types can only prove the generated types
// match the contract; this is what proves the server sends what they say.

import { expect, test } from "@playwright/test"
import { routes, type Wired } from "../src/api/routes.ts"
import type { Backend } from "../src/contract/actions"
import { createHttpBackend } from "../src/data/http.ts"
import { loadContract } from "./contract-shape.ts"
import { flakySite, smtpSink, startBertha, type Mail } from "./harness.ts"

test.describe.configure({ mode: "serial" })

const FIXTURES_NOW = "2026-10-13T09:12:00Z"
const OWNER = "hello@sundial.dev"
const COLLABORATOR = "priya@natarajan.studio"

const contract = loadContract()
const called = new Set<Wired>()
const answered = new Set<Wired>()
const problems: string[] = []

let server: Awaited<ReturnType<typeof startBertha>>
let sink: Awaited<ReturnType<typeof smtpSink>>
let site: Awaited<ReturnType<typeof flakySite>>
let cookie = ""
let live: Awaited<ReturnType<typeof watchLive>>
let backend: Backend
const realFetch = globalThis.fetch

type Reply<M extends Wired> = Awaited<ReturnType<Backend[M]>>
type Failed<M extends Wired> = Extract<Reply<M>, { ok: false }>["failure"]
type Succeeded<M extends Wired> = Extract<Reply<M>, { ok: true }>["value"]

/** Calls a method and records whatever doesn't fit the contract. */
async function ask<M extends Wired>(method: M, ...args: Parameters<Backend[M]>): Promise<Reply<M>> {
  called.add(method)
  const reply = await (backend[method] as (...a: unknown[]) => Promise<unknown>)(...args)
  if (reply !== null) answered.add(method)
  problems.push(...contract.check(contract.replyOf(method), reply, method))
  return reply as Reply<M>
}

/** A mutation that must work, and its value. */
async function ok<M extends Wired>(method: M, ...args: Parameters<Backend[M]>): Promise<Succeeded<M>> {
  const reply = (await ask(method, ...args)) as { ok: boolean; value?: unknown; failure?: string; message?: string }
  expect(reply.ok, `${method} failed: ${reply.failure} ${reply.message}`).toBe(true)
  return reply.value as Succeeded<M>
}

/** A mutation that must fail this way. */
async function fails<M extends Wired>(method: M, failure: Failed<M>, ...args: Parameters<Backend[M]>) {
  const reply = (await ask(method, ...args)) as { ok: boolean; failure?: string }
  expect(reply.failure, `${method} should fail with ${String(failure)}`).toBe(failure)
}

async function signInAs(email: string) {
  cookie = ""
  backend = createHttpBackend()
  await ok("signIn", email)
  const mails = (await (await realFetch(`http://127.0.0.1:${sink.httpPort}`)).json()) as Mail[]
  const link = mails.reverse().find((m) => m.to.includes(email))?.body.match(/https?:\/\/\S+/)?.[0]
  expect(link, `a sign-in email to ${email}`).toBeTruthy()
  const res = await realFetch(link!, { redirect: "manual" })
  cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]
  expect(cookie, "a session cookie").toBeTruthy()
}

/** Reads `/api/v1/live` for the whole run, so every change the suite makes gets held to `LiveEvent`. */
async function watchLive() {
  const stop = new AbortController()
  const reply = await realFetch(`${server.url}/api/v1/live`, { headers: { cookie }, signal: stop.signal })
  expect(reply.ok).toBe(true)
  const reader = reply.body!.pipeThrough(new TextDecoderStream()).getReader()
  const events: unknown[] = []
  const done = (async () => {
    let buffer = ""
    for (;;) {
      const { value, done } = await reader.read()
      if (done) return
      buffer += value
      const lines = buffer.split("\n")
      buffer = lines.pop()!
      for (const line of lines) if (line.startsWith("data:")) events.push(JSON.parse(line.slice(5)))
    }
  })().catch(() => {})
  return { events, stop, done }
}

const issueFilter = (over: Partial<Parameters<Backend["listIssues"]>[0]> = {}): Parameters<Backend["listIssues"]>[0] => ({
  projectIds: [],
  status: "all",
  levels: [],
  environment: "all",
  assignee: "anyone",
  query: "",
  sort: "last_seen",
  range: "30d",
  labels: [],
  ...over,
})

const logFilter = (over: Partial<Parameters<Backend["listLogs"]>[0]> = {}): Parameters<Backend["listLogs"]>[0] => ({
  projectIds: [],
  minLevel: "debug",
  environment: "all",
  query: "",
  range: "30d",
  until: null,
  patternId: null,
  ...over,
})

test.beforeAll(async () => {
  sink = await smtpSink()
  site = await flakySite()
  server = await startBertha(sink.smtpPort, 1, { seeded: { fixedNow: FIXTURES_NOW } })
  globalThis.fetch = ((input: string, init: RequestInit = {}) =>
    realFetch(server.url + input, { ...init, headers: { ...(init.headers as Record<string, string>), cookie } })) as typeof fetch
  ;(globalThis as { window?: unknown }).window = { location: { pathname: "/", search: "?next=/issues", assign() {} } }
  await signInAs(OWNER)
  live = await watchLive()
})

test.afterAll(async () => {
  globalThis.fetch = realFetch
  delete (globalThis as { window?: unknown }).window
  live?.stop.abort()
  await server?.stop()
  site?.close()
  sink?.close()
})

test.afterEach(() => {
  const found = problems.splice(0)
  expect(found, `replies that don't fit src/contract:\n${found.slice(0, 40).join("\n")}`).toEqual([])
})

test("reads", async () => {
  await ask("getShell")
  for (const range of ["24h", "7d", "30d"] as const) {
    await ask("getOverview", range, null)
    await ask("listProjects", range)
  }
  await ask("getOverview", "24h", "p-kiln")
  await ask("getOverview", "24h", "p-missing")

  const list = await ask("listIssues", issueFilter())
  expect(list.issues.length, "the seed has issues").toBeGreaterThan(0)
  await ask("listIssues", issueFilter({ status: "unresolved", assignee: "me", sort: "events" }))
  for (const i of list.issues) await ask("getIssue", i.id)
  await ask("getIssue", "i-missing")

  for (const [issue, event] of [["i-cart-map", "e-cart-1"], ["i-cart-map", "e-cart-2"], ["i-hydration", "e-hydration-1"], ["i-noisy", "e-noisy-1"], ["i-harbour-fetch", "e-harbour-1"], ["i-moss-regressed", "e-moss-1"], ["i-longest", "e-longest-1"], ["i-no-stack", "e-nostack-1"], ["i-7", "e-harbour-hold-1"], ["i-40", "e-extension-1"]]) {
    await ask("getEvent", issue, { eventId: event })
    await ask("getTrace", issue, event)
    await ask("getEventLogs", issue, event)
  }
  await ask("getEvent", "i-cart-map", "latest")
  await ask("getEvent", "i-cart-map", "oldest")
  await ask("getTrace", "i-cart-map", "e-missing")
  await ask("getEventLogs", "i-cart-map", "e-missing")

  const logs = await ask("listLogs", logFilter())
  expect(logs.lines.length, "the seed has log lines").toBeGreaterThan(0)
  if (logs.older) await ask("listLogs", logFilter(), { older: logs.older })
  if (logs.newer) await ask("listLogs", logFilter(), { newer: logs.newer })
  await ask("listLogs", logFilter({ minLevel: "error", query: "nothing-matches-this" }))
  const patterns = await ask("listLogPatterns", logFilter())
  if (patterns.patterns[0]) await ask("listLogs", logFilter({ patternId: patterns.patterns[0].id }))

  const releases = await ask("listReleases", null)
  await ask("listReleases", "p-kiln")
  for (const r of releases.releases) await ask("getRelease", r.id)
  await ask("getRelease", "r-missing")

  const monitors = await ask("listMonitors")
  for (const m of monitors.monitors) await ask("getMonitor", m.id)
  await ask("getMonitor", "mon-missing")

  const projects = await ask("listProjects", "24h")
  for (const p of projects.projects) {
    await ask("getProjectSettings", p.id)
    await ask("getProjectSetup", p.id)
  }
  await ask("getProjectSettings", "p-missing")

  await ask("getAlerts")
  await ask("getTeam")
  await ask("getAgents")
  for (const token of ["valid", "expired", "used", "missing"]) await ask("getInvite", token)
})

test("issues", async () => {
  await fails("updateIssues", "not_found", ["i-missing"], { kind: "ignore" })
  await fails("updateIssues", "no_fix", ["i-13"], { kind: "fix_shipped" })

  // A second tab that saw the issue before this one changed it.
  await ask("getIssue", "i-13")
  const stale = backend
  backend = createHttpBackend()
  await ask("getIssue", "i-13")
  await ok("updateIssues", ["i-13"], { kind: "assign", personId: "m-owner" })
  backend = stale
  await fails("updateIssues", "conflict", ["i-13"], { kind: "ignore" })
  backend = createHttpBackend()

  await ok("updateIssues", ["i-13"], { kind: "label", add: ["checked"], remove: [] })
  await ok("updateIssues", ["i-13"], { kind: "snooze", snooze: { kind: "until", until: "2026-10-20T09:12:00Z" } })
  await ok("updateIssues", ["i-13"], { kind: "snooze", snooze: { kind: "events", total: 10, remaining: 10 } })
  await ok("updateIssues", ["i-13"], { kind: "reopen" })
  await ok("updateIssues", ["i-13"], { kind: "ignore" })
  await ok("updateIssues", ["i-13"], { kind: "resolve", inNextRelease: true })
  await ok("updateIssues", ["i-13"], { kind: "reopen" })
  await ok("updateIssues", ["i-13"], { kind: "assign", personId: null })

  await ok("addIssueNote", "i-13", "Checked against the contract.")
  await fails("addIssueNote", "not_found", "i-missing", "Nowhere.")

  const triage = await ok("startTriage", "i-13")
  await fails("startTriage", "not_found", "i-missing")
  await ok("updateTriage", triage.id, { found: "A cause.", tried: "A thing." })
  await ok("updateTriage", triage.id, { fix: "A fix in abc1234.", commit: "abc1234", outcome: "fixed" })
  await fails("updateTriage", "concluded", triage.id, { found: "Later." })
  await fails("updateTriage", "not_found", "t-missing", { found: "Nowhere." })
  await ok("updateIssues", ["i-13"], { kind: "fix_shipped" })

  await fails("mergeIssues", "not_found", "i-missing", ["i-5"])
  await fails("mergeIssues", "different_projects", "i-5", ["i-7"])
})

test("projects", async () => {
  const input = { name: "Contract check", client: null, url: null, repoUrl: null, runtimes: ["server" as const], environments: ["production" as const] }
  const created = await ok("createProject", input)
  const id = created.project.id
  await fails("createProject", "name_taken", input)
  await fails("createProject", "invalid_name", { ...input, name: "  " })
  await fails("createProject", "key_taken", { ...input, name: "Another", key: created.project.key })
  await fails("createProject", "invalid_key", { ...input, name: "Another", key: "!" })
  await ok("updateProject", id, { ...input, name: "Contract checked", brief: "A brief.", watchFixes: false, logs: { minLevel: "warning", retentionDays: 7 } })
  await fails("updateProject", "invalid_name", id, { ...input, name: "  ", brief: null })
  await fails("updateProject", "name_taken", id, { ...input, name: "Kiln & Clay", brief: null })
  await ok("rotateIngestKey", id)
  await fails("deleteProject", "name_mismatch", id, "Not its name")
  await ok("deleteProject", id, "Contract checked")
})

test("uptime", async () => {
  const input = { projectId: "p-kiln", name: "Contract site", url: `http://127.0.0.1:${site.port}/health`, intervalSeconds: 60 as const, paused: false }
  const monitor = await ok("saveMonitor", input)
  await ask("getMonitor", monitor.id)
  await ok("saveMonitor", { ...input, id: monitor.id, paused: true })
  await fails("saveMonitor", "invalid_url", { ...input, url: "not a url" })
  await realFetch(`http://127.0.0.1:${site.port}/down`, { method: "POST" })
  await fails("saveMonitor", "unreachable", { ...input, name: "Down" })
  await ok("checkMonitorNow", monitor.id)
  await ask("getMonitor", monitor.id)
  await realFetch(`http://127.0.0.1:${site.port}/up`, { method: "POST" })
  await ok("checkMonitorNow", monitor.id)
  await fails("checkMonitorNow", "not_found", "mon-missing")
  await ok("deleteMonitor", monitor.id)
  await fails("deleteMonitor", "not_found", monitor.id)
})

test("alerts", async () => {
  const email = await ok("saveDestination", { kind: "email", address: "contract@e2e.test" })
  await ok("saveDestination", { id: email.id, kind: "email", address: "contract2@e2e.test" })
  await fails("saveDestination", "invalid_email", { kind: "email", address: "nope" })
  await fails("saveDestination", "invalid_webhook", { kind: "webhook", label: "Nope", url: "nope" })
  await ok("testDestination", email.id)
  // Webhooks must be https, and nothing answers on this port.
  const hook = await ok("saveDestination", { kind: "webhook", label: "Down", url: "https://127.0.0.1:9/hook" })
  await fails("testDestination", "delivery_failed", hook.id)

  const rule = { name: "Contract rule", projectIds: "all" as const, environments: ["production" as const], triggers: ["new_issue" as const], spike: null, logMatch: null, destinationIds: [email.id], enabled: true }
  const saved = await ok("saveAlertRule", rule)
  await ok("saveAlertRule", { ...rule, id: saved.id, projectIds: ["p-kiln"] })
  await fails("saveAlertRule", "no_destination", { ...rule, destinationIds: [] })
  await fails("saveAlertRule", "no_trigger", { ...rule, triggers: [] })
  await ok("deleteAlertRule", saved.id)
  await fails("deleteAlertRule", "not_found", saved.id)
  const onlyHere = await ok("saveAlertRule", { ...rule, destinationIds: [hook.id] })
  const deleted = await ok("deleteDestination", hook.id)
  expect(deleted.rulesTurnedOff).toContain(onlyHere.id)
  await fails("deleteDestination", "not_found", hook.id)
  await ok("deleteDestination", email.id)
})

test("team and agents", async () => {
  const member = await ok("inviteMember", { email: "contract@e2e.test", projectIds: ["p-kiln"] })
  await fails("inviteMember", "already_member", { email: COLLABORATOR, projectIds: ["p-kiln"] })
  await fails("inviteMember", "invalid_email", { email: "nope", projectIds: ["p-kiln"] })
  await ok("updateMemberAccess", member.id, ["p-kiln", "p-harbour"])
  await ok("resendInvite", member.id)
  await fails("resendInvite", "not_found", "m-missing")
  await fails("resendInvite", "already_member", "m-priya")
  await ok("removeMember", member.id)
  await fails("removeMember", "cannot_remove_owner", "m-owner")

  const token = await ok("createAccessToken", "contract check")
  await fails("createAccessToken", "invalid_name", "  ")
  await ask("getAgents")
  await ok("revokeAccessToken", token.token.id)
  await fails("revokeAccessToken", "not_found", "tok-missing")
  await fails("setAgentReportDone", "not_found", "rep-missing", true)

  await fails("signIn", "unknown_email", "nobody@e2e.test")
  // All three tokens belong to one pending member, so expired has to come before they join.
  await fails("acceptInvite", "invite_expired", "expired")
  await fails("acceptInvite", "invite_used", "used")
  await ok("acceptInvite", "valid")
})

test("what a collaborator is told", async () => {
  await signInAs(COLLABORATOR)
  await ask("getShell")
  await ask("listIssues", issueFilter())
  await fails("updateMemberAccess", "permission_denied", "m-tomasz", [])
  await fails("rotateIngestKey", "permission_denied", "p-kiln")
  await fails("deleteProject", "permission_denied", "p-kiln", "Kiln & Clay")
  await fails("deleteMonitor", "permission_denied", "mon-kiln")
  await fails("updateProject", "permission_denied", "p-kiln", { name: "Kiln", client: null, url: null, repoUrl: null, runtimes: ["server"], environments: ["production"], brief: null })
  await fails("setAgentReportDone", "permission_denied", "rep-missing", true)
  await signInAs(OWNER)
})

test("the live stream", async () => {
  await ok("updateIssues", ["i-5"], { kind: "resolve" })
  await expect.poll(() => live.events.length, { message: "a change reaches the live stream" }).toBeGreaterThan(0)
  live.stop.abort()
  await live.done
  const type = contract.named("domain", "LiveEvent")
  for (const [i, event] of live.events.entries()) problems.push(...contract.check(type, event, "LiveEvent").map((e) => `live[${i}] ${e}`))
})

test("every Backend method was called", () => {
  const methods = Object.keys(routes) as Wired[]
  expect(methods.filter((m) => !called.has(m)), "Backend methods this suite doesn't call").toEqual([])
  // Null fits many replies, and it's also what a wrong route tends to answer.
  expect(methods.filter((m) => !answered.has(m)), "Backend methods that only ever answered null").toEqual([])
})
