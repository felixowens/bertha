// Helpers the journeys share: addresses from global setup, mail, the CLI, ingest.

import { execFileSync } from "node:child_process"
import { expect, type Page } from "@playwright/test"
import { binary, type Mail } from "./harness.ts"

export const url = (path: string) => `${process.env.E2E_URL}${path}`
export const site = (path: string) => `${process.env.E2E_SITE}${path}`

/** Waits for the newest email to `to` whose subject matches, and returns its first link. */
export async function linkFrom(to: string, subject: RegExp): Promise<string> {
  let found: Mail | undefined
  await expect
    .poll(async () => {
      const mails = (await (await fetch(process.env.E2E_MAIL!)).json()) as Mail[]
      found = mails.reverse().find((m) => m.to.includes(to) && subject.test(m.subject))
      return found?.subject ?? null
    }, { message: `an email to ${to} matching ${subject}` })
    .not.toBeNull()
  const link = found!.body.match(/https?:\/\/\S+/)?.[0]
  expect(link, found!.body).toBeTruthy()
  return link!
}

export function cli(...args: string[]): string {
  const env = JSON.parse(process.env.E2E_BERTHA_ENV!) as Record<string, string>
  return execFileSync(binary(), args, { env: { ...process.env, ...env }, encoding: "utf8" })
}

/** A project's ingest key, from the CLI as an operator would get it. */
export function ingestKey(project: string): string {
  return cli("project", "keys", project).match(/^BERTHA_KEY=(.+)$/m)![1]
}

/** Sends events the way the SDK does. */
export async function ingest(key: string, events: object[]) {
  const r = await fetch(url("/ingest/v1/events"), {
    method: "POST",
    headers: { "content-type": "text/plain", authorization: `Bearer ${key}` },
    body: JSON.stringify({ sdk: { name: "@bigbertha/sdk", version: "0.1.0" }, events }),
  })
  expect(r.status, await r.clone().text()).toBe(202)
}

export const error = (type: string, message: string, release = "1.0.0") => ({
  timestamp: new Date().toISOString(),
  release,
  environment: "production",
  level: "error",
  exception: { type, message, frames: [{ file: "app/routes/plots.ts", function: "plantSeeds", line: 42, column: 7, inApp: true }] },
})

export async function signIn(page: Page, email: string) {
  await page.goto(url("/sign-in"))
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a link" }).click()
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible()
  await page.goto(await linkFrom(email, /sign in/i))
}
