// The owner's journeys through a real bertha: sign in by email, connect a project,
// triage what arrives, watch a site go down and come back, and invite a collaborator.

import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { resolve } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { init as initNode, wrapHandler } from "../sdk/src/node/index.ts"
import { cli, error, ingest, ingestKey, linkFrom, signIn, site, url } from "./support.ts"

test.describe.configure({ mode: "serial" })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage()
})

async function createProject(name: string, siteUrl = "") {
  await page.goto(url("/projects/new"))
  await page.getByLabel("Name").fill(name)
  if (siteUrl) await page.getByLabel("Site URL").fill(siteUrl)
  await page.getByRole("button", { name: "Create project" }).click()
  await expect(page.getByText("Listening for the first event…")).toBeVisible()
}

test("the owner signs in with an emailed link", async () => {
  await page.goto(url("/"))
  await expect(page, "signed out, any page goes to sign-in").toHaveURL(/\/sign-in/)
  await signIn(page, "owner@e2e.test")
  await expect(page).toHaveURL(url("/"))
  await expect(page.getByText("Olu Owner")).toBeVisible()

  // A link works once.
  const used = await linkFrom("owner@e2e.test", /sign in/i)
  const other = await (await page.context().browser()!.newContext()).newPage()
  await other.goto(used)
  await expect(other.getByText("That link was already used. Each link works once.")).toBeVisible()
  await other.context().close()
})

test("a new project hears its first event", async () => {
  await createProject("Allotment Planner", site("/health"))
  await ingest(ingestKey("Allotment Planner"), [error("RangeError", "Plot 14 has no beds")])
  await page.getByRole("link", { name: "See its issues" }).click()
  await expect(page.getByText("Plot 14 has no beds")).toBeVisible()
})

test("new issues show up on an open list without a reload", async () => {
  await expect(page).toHaveURL(/\/issues\?project=/)
  await ingest(ingestKey("Allotment Planner"), [error("TypeError", "Cannot read properties of undefined (reading 'seed')")])
  await page.getByRole("button", { name: /1 new issue/ }).click()
  await expect(page.getByText("Cannot read properties of undefined (reading 'seed')")).toBeVisible()
})

test("resolve an issue, and a later event reopens it as a regression", async () => {
  await page.getByText("Plot 14 has no beds").click()
  await expect(page.getByRole("heading", { name: /Plot 14 has no beds/ })).toBeVisible()
  await page.getByRole("button", { name: /Resolve/ }).click()
  await expect(page.getByRole("button", { name: /Reopen/ })).toBeVisible()

  await ingest(ingestKey("Allotment Planner"), [error("RangeError", "Plot 14 has no beds", "1.0.1")])
  // The open page hears about it and shows the issue as open again.
  await expect(page.getByRole("button", { name: /Resolve/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("after being resolved")).toBeVisible()
  await expect(page.getByText(/^Event\s*1\s*of\s*2$/), "the pager follows the newest event").toBeVisible()
})

test("a site goes down and comes back", async () => {
  await page.goto(url("/uptime"))
  await page.getByRole("button", { name: "Add monitor" }).first().click()
  const form = page.getByRole("dialog")
  await expect(form.getByLabel("URL"), "the URL comes from the project").toHaveValue(site("/health"))
  await form.getByRole("button", { name: "Add monitor" }).click()
  await expect(page.getByText(/First check passed/)).toBeVisible()
  await expect(page.getByText("Allotment Planner").first()).toBeVisible()

  await fetch(site("/down"), { method: "POST" })
  // Two failed checks in a row; the page hears it live.
  await expect(page.getByText("1 down")).toBeVisible({ timeout: 20_000 })

  await fetch(site("/up"), { method: "POST" })
  await expect(page.getByText("All 1 answering")).toBeVisible({ timeout: 20_000 })
})

test("a collaborator accepts an invite and sees only their project", async ({ browser }) => {
  await createProject("Harbour Tides")
  await page.goto(url("/settings/team"))
  await page.getByRole("button", { name: "Invite" }).first().click()
  const form = page.getByRole("dialog")
  await form.getByLabel("Email").fill("priya@e2e.test")
  await form.getByText("Harbour Tides").click()
  await form.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByRole("main").getByText("priya@e2e.test")).toBeVisible()

  const link = await linkFrom("priya@e2e.test", /invited you/)
  const priya = await (await browser.newContext()).newPage()
  await priya.goto(link)
  await priya.getByRole("button", { name: "Accept invitation" }).click()
  await priya.getByRole("link", { name: "Open bertha" }).click()
  await expect(priya).toHaveURL(url("/"))
  const sidebar = priya.getByRole("navigation").first()
  await expect(priya.getByText("Harbour Tides").first()).toBeVisible()
  await expect(priya.getByText("Allotment Planner")).toHaveCount(0)

  // Owner-only pages say so.
  await priya.goto(url("/settings/team"))
  await expect(sidebar).toBeVisible()
  await expect(priya.getByRole("button", { name: "Invite" })).toHaveCount(0)
  await priya.context().close()
})

test("the owner finds a project, edits it and keeps a second monitor", async () => {
  await page.goto(url("/projects"))
  await page
    .getByRole("link", { name: /Allotment Planner/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/projects\/[^/]+$/)
  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await expect(page).toHaveURL(/\/projects\/[^/]+\/settings$/)

  await page.getByLabel("Client").fill("Hillside Allotments")
  await page.getByLabel("Repository URL").fill("https://github.com/e2e/allotment")
  await page.getByRole("button", { name: "Save details" }).click()
  await expect(page.getByText("Project saved.")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Client")).toHaveValue("Hillside Allotments")

  await page.getByRole("button", { name: "Add another monitor" }).click()
  const form = page.getByRole("dialog")
  await form.getByLabel("URL").fill(site("/plots"))
  await form.getByLabel("Name").fill("Plots page")
  await form.getByRole("button", { name: "Add monitor" }).click()
  const added = page.getByRole("link", { name: "Plots page", exact: true })
  await expect(added).toBeVisible()
  const edits = page.getByRole("button", { name: "Edit", exact: true })
  await expect(edits).toHaveCount(2)

  await edits.last().click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete monitor" }).click()
  await expect(added).toHaveCount(0)
  await expect(edits).toHaveCount(1)
})

test("the range narrows the issue list", async () => {
  await page.goto(url("/issues"))
  await expect(page.getByText("Plot 14 has no beds")).toBeVisible()
  await page.getByRole("button", { name: /Range/ }).click()
  await page.getByRole("menuitemradio", { name: "24h" }).click()
  await expect(page).toHaveURL(/range=24h/)
  // Everything here happened minutes ago, so it all stays.
  await expect(page.getByText("Plot 14 has no beds")).toBeVisible()
})

test("assigning an issue to a collaborator emails them a link to it", async () => {
  await ingest(ingestKey("Harbour Tides"), [error("TypeError", "Tide table is empty")])
  await page.goto(url("/issues"))
  await page.getByText("Tide table is empty").click()
  await expect(page.getByRole("heading", { name: /Tide table is empty/ })).toBeVisible()
  const issue = page.url()
  await page.getByRole("button", { name: /Assign/ }).click()
  await page.getByRole("menuitem", { name: /priya/i }).click()
  const link = await linkFrom("priya@e2e.test", /assigned/)
  expect(new URL(link).pathname).toBe(new URL(issue).pathname)
})

test("a destination can be edited and deleted", async () => {
  await page.goto(url("/settings/alerts"))
  await page.getByRole("button", { name: "Add a destination" }).click()
  let form = page.getByRole("dialog")
  await form.getByLabel("Email address").fill("alerts@e2e.test")
  await form.getByRole("button", { name: "Add destination" }).click()
  const main = page.getByRole("main")
  await expect(main.getByText("alerts@e2e.test")).toBeVisible()

  await page.getByRole("button", { name: /^Edit alerts@e2e\.test/ }).click()
  form = page.getByRole("dialog")
  await form.getByLabel("Email address").fill("pager@e2e.test")
  await form.getByRole("button", { name: "Save" }).click()
  await expect(main.getByText("pager@e2e.test")).toBeVisible()
  await expect(main.getByText("alerts@e2e.test")).toHaveCount(0)

  await page.getByRole("button", { name: /^Edit pager@e2e\.test/ }).click()
  form = page.getByRole("dialog")
  await form.getByRole("button", { name: "Delete" }).click()
  await form.getByRole("button", { name: "Delete destination" }).click()
  await expect(page.getByText("Destination deleted.")).toBeVisible()
  await expect(page.getByText("No alerts yet.")).toBeVisible()
})

test("a pending invite can be resent", async () => {
  const sentTo = async (to: string) => ((await (await fetch(process.env.E2E_MAIL!)).json()) as { to: string[] }[]).filter((m) => m.to.includes(to)).length
  await page.goto(url("/settings/team"))
  await page.getByRole("button", { name: "Invite" }).first().click()
  const form = page.getByRole("dialog")
  await form.getByLabel("Email").fill("late@e2e.test")
  await form.getByText("Harbour Tides").click()
  await form.getByRole("button", { name: "Send invitation" }).click()
  await expect(page.getByRole("main").getByText("late@e2e.test")).toBeVisible()
  const first = await linkFrom("late@e2e.test", /invited you/)
  expect(await sentTo("late@e2e.test")).toBe(1)

  await page.getByRole("listitem").filter({ hasText: "late@e2e.test" }).getByRole("button", { name: "Resend" }).click()
  await expect.poll(() => sentTo("late@e2e.test")).toBe(2)
  const second = await linkFrom("late@e2e.test", /invited you/)
  expect(second).not.toBe(first)
})

test("an agent triages an issue over MCP with a token made in Settings → Agents", async () => {
  await page.goto(url("/settings/agents"))
  await expect(page.getByText("No tokens. Agents can't reach bertha yet.")).toBeVisible()
  await page.getByRole("button", { name: "New token" }).click()
  const form = page.getByRole("dialog")
  await form.getByLabel("Name").fill("claude on e2e")
  await form.getByRole("button", { name: "Create token" }).click()
  await form.getByRole("button", { name: "Show access token" }).click()
  const secret = (await form.getByLabel("Access token", { exact: true }).textContent())!.trim()
  expect(secret).toMatch(/^ba_/)
  await form.getByRole("button", { name: "Done" }).click()
  await expect(page.getByRole("main").getByText("never used")).toBeVisible()

  let id = 0
  const mcp = (method: string, params: object) =>
    fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    })
  const call = async (name: string, args: object) => {
    const res = await mcp("tools/call", { name, arguments: args })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { isError: boolean; content: { text: string }[] } }
    expect(body.result.isError, body.result.content[0].text).toBe(false)
    return body.result.content[0].text
  }

  // The agent is handed the issue's link, the way a person pastes it.
  await page.goto(url("/issues"))
  await page.getByText("Tide table is empty").click()
  await expect(page.getByRole("heading", { name: /Tide table is empty/ })).toBeVisible()
  const link = page.url()
  expect((await (await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } })).json()).result.serverInfo.name).toBe("bertha")
  expect(await call("get_issue", { issue: link })).toContain("Tide table is empty")
  await call("add_note", { issue: link, body: "The tide feed returned an empty table. Guarded in `tides.ts`." })

  await page.reload()
  await expect(page.getByText("via claude on e2e")).toBeVisible()
  await expect(page.getByText("Guarded in")).toBeVisible()

  // The agent claims the issue, and the page says someone is on it.
  const started = await call("start_triage", { issue: link })
  const triage = started.match(/`(tr_[a-z0-9]+)`/)![1]
  await expect(page.getByText(/Your agent\s*claude on e2e\s*is on it/)).toBeVisible({ timeout: 15_000 })
  await call("update_triage", { triage, found: "The tide feed answers an empty table at slack water.", outcome: "fixed" })
  await call("update_issue", { issue: link, action: "label", add_labels: ["tides"] })
  await page.reload()
  await page.getByRole("button", { name: /^Fixed/ }).click()
  await expect(page.getByText("The tide feed answers an empty table at slack water.")).toBeVisible()
  await expect(page.getByRole("link", { name: "tides", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "tides", exact: true }).click()
  await expect(page).toHaveURL(/label=tides/)
  await expect(page.getByText("Tide table is empty")).toBeVisible()

  // When bertha itself gets in the way, the agent tells the owner, who reads it in Settings.
  expect(await call("report_problem", { summary: "get_issue left out the tide feed's URL", details: "Had to guess which feed.", tool: "get_issue", issue: link })).toContain("Sent the problem")
  await page.goto(url("/settings/agents"))
  const report = page.getByRole("button", { name: /get_issue left out the tide feed's URL/ })
  await expect(report).toBeVisible()
  await expect(page.getByText("via claude on e2e")).toBeVisible()
  await report.click()
  await expect(page.getByText("Had to guess which feed.")).toBeVisible()
  await page.getByRole("button", { name: "Mark done" }).click()
  await expect(page.getByText("Nothing open.")).toBeVisible()


  await page.getByRole("button", { name: "Revoke claude on e2e" }).click()
  await page.getByRole("button", { name: "Revoke", exact: true }).click()
  await expect(page.getByText("No tokens. Agents can't reach bertha yet.")).toBeVisible()
  expect((await mcp("tools/list", {})).status).toBe(401)
})

test("a page's error and the server error its request caused list each other", async ({ browser }) => {
  await createProject("Shop web")
  await createProject("Shop api")
  const webKey = ingestKey("Shop web")
  initNode({ key: ingestKey("Shop api"), url: url(""), release: "api-1", handlers: false, heartbeat: false })

  // A shop on its own origin: a page using the built browser SDK, and an API behind the node SDK.
  const pay = wrapHandler((_req: unknown, _res: unknown) => {
    throw new Error("Card declined by the test gateway")
  })
  const dist = resolve(import.meta.dirname, "../sdk/dist")
  const shop: Server = createServer(async (req, res) => {
    if (req.url?.startsWith("/sdk/")) {
      res.setHeader("content-type", "text/javascript")
      res.end(await readFile(resolve(dist, req.url.slice(5))))
    } else if (req.url === "/api/pay") {
      try {
        pay(req, res)
      } catch {
        res.statusCode = 500
        res.end()
      }
    } else {
      res.setHeader("content-type", "text/html")
      res.end(`<!doctype html><title>Shop</title><script type="module">
        import { init } from "/sdk/browser/index.js"
        init({ key: ${JSON.stringify(webKey)}, url: ${JSON.stringify(url(""))}, release: "web-1" })
        document.cookie = "session=s3cret-cookie"
        fetch("/api/pay", { method: "POST", headers: { authorization: "Bearer hunter2-token" } }).then((r) => {
          if (!r.ok) throw new Error("Payment failed with " + r.status)
        })
      </script>`)
    }
  })
  await new Promise<void>((done) => shop.listen(0, "127.0.0.1", done))
  const shopUrl = `http://127.0.0.1:${(shop.address() as AddressInfo).port}`
  const visitor = await (await browser.newContext({ viewport: { width: 1194, height: 702 } })).newPage()
  try {
    await visitor.goto(`${shopUrl}/checkout`)
    await expect(async () => {
      await page.goto(url("/issues"))
      await expect(page.getByText("Payment failed with 500")).toBeVisible({ timeout: 1000 })
      await expect(page.getByText("Card declined by the test gateway")).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 20_000 })
  } finally {
    await visitor.context().close()
    shop.close()
  }

  // The browser event: where, how and in what state.
  await page.getByText("Payment failed with 500").click()
  const web = page.getByRole("main")
  await expect(web.getByText("onunhandledrejection")).toBeVisible()
  await expect(web.getByRole("heading", { name: "Page", exact: true })).toBeVisible()
  await expect(web.getByRole("definition").filter({ hasText: `${shopUrl}/checkout` })).toBeVisible()
  await expect(web.getByText(/^1194×702/)).toBeVisible()
  await expect(web.getByRole("heading", { name: "Same trace" })).toBeVisible()

  // Its request's server error, one link away, with the headers minus credentials.
  await web.getByRole("link", { name: /Card declined by the test gateway/ }).click()
  await expect(page.getByRole("heading", { name: /Card declined by the test gateway/ })).toBeVisible()
  const api = page.getByRole("main")
  await expect(api.getByRole("heading", { name: "Request headers" })).toBeVisible()
  await expect(api.getByText("user-agent", { exact: true })).toBeVisible()
  await expect(api.getByText(/s3cret-cookie|hunter2-token/)).toHaveCount(0)
  await expect(api.getByRole("link", { name: /Payment failed with 500/ }), "and it links back").toBeVisible()
})

test("a fixed triage resolves its issue when the PR ships", async () => {
  const secret = cli("token", "create", "--email", "owner@e2e.test", "--name", "claude on ci").match(/\bba_\S+/)![0]
  let id = 0
  const call = async (name: string, args: object) => {
    const res = await fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
    })
    const body = (await res.json()) as { result: { isError: boolean; content: { text: string }[] } }
    expect(body.result.isError, body.result.content[0].text).toBe(false)
    return body.result.content[0].text
  }
  const github = (path: string) => fetch(`${process.env.E2E_GITHUB}${path}`, { method: "POST" })
  // The worker checks every second; reload until the page shows what it found.
  const reloadUntil = (text: string | RegExp) =>
    expect(async () => {
      await page.reload()
      await expect(page.getByText(text)).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

  // Allotment Planner's repo is https://github.com/e2e/allotment (set in an earlier journey).
  // Its own frame, so it doesn't group with the planner's other TypeError.
  const frost = (release: string) => {
    const e = error("TypeError", "Frost dates are missing", release)
    return { ...e, exception: { ...e.exception, frames: [{ file: "app/routes/frost.ts", function: "loadFrost", line: 9, column: 3, inApp: true }] } }
  }
  await ingest(ingestKey("Allotment Planner"), [frost("1.0.0")])
  await page.goto(url("/issues"))
  await page.getByText("Frost dates are missing").click()
  await expect(page.getByRole("heading", { name: /Frost dates are missing/ })).toBeVisible()
  const link = page.url()

  const triage = (await call("start_triage", { issue: link })).match(/`(tr_[a-z0-9]+)`/)![1]
  const ended = await call("update_triage", { triage, found: "The frost table loads after the planner.", pr: 7, outcome: "fixed" })
  expect(ended).toContain("bertha is watching PR #7")
  await page.reload()
  await expect(page.getByText("Waiting for #7 to merge.")).toBeVisible()

  const sha = "f1e2d3c4b5a6978877665544332211ffeeddccbb"
  await github(`/merge/e2e/allotment/7?sha=${sha}`)
  await reloadUntil(/#7 merged as f1e2d3c/)

  // CI records the production deploy, and GitHub says its commit contains the fix.
  const release = "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0"
  await github(`/ship/e2e/allotment?fix=${sha}&release=${release}`)
  const upload = cli("project", "keys", "Allotment Planner").match(/^BERTHA_UPLOAD_KEY=(.+)$/m)![1]
  const r = await fetch(url("/ingest/v1/deploys"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${upload}` },
    body: JSON.stringify({ release: "1.1.0", environment: "production", commit: { sha: release, message: "Load the frost table first", author: "Olu" } }),
  })
  expect(r.status, await r.clone().text()).toBe(201)

  await reloadUntil("bertha saw #7 ship in 1.1.0")
  await expect(page.getByRole("button", { name: /Reopen/ })).toBeVisible()
  await expect(page.getByText("Shipped in 1.1.0.")).toBeVisible()

  // Events from the build before the fix don't reopen it.
  await ingest(ingestKey("Allotment Planner"), [frost("1.0.0")])
  await page.reload()
  await expect(page.getByRole("button", { name: /Reopen/ })).toBeVisible()
})

test("signing out ends the session", async () => {
  await page.goto(url("/"))
  await page.getByRole("button", { name: /Olu Owner/ }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.goto(url("/issues"))
  await expect(page).toHaveURL(/\/sign-in/)
})
