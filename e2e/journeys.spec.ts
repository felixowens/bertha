// The owner's journeys through a real bertha: sign in by email, connect a project,
// triage what arrives, watch a site go down and come back, and invite a collaborator.

import { expect, test, type Page } from "@playwright/test"
import { error, ingest, ingestKey, linkFrom, signIn, site, url } from "./support.ts"

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

test("signing out ends the session", async () => {
  await page.goto(url("/"))
  await page.getByRole("button", { name: /Olu Owner/ }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.goto(url("/issues"))
  await expect(page).toHaveURL(/\/sign-in/)
})
