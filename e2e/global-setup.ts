import { flakySite, smtpSink, startBertha } from "./harness.ts"

export default async function setup() {
  const sink = await smtpSink()
  const site = await flakySite()
  const bertha = await startBertha(sink.smtpPort)
  // Workers read these (see e2e/support.ts).
  process.env.E2E_URL = bertha.url
  process.env.E2E_MAIL = `http://127.0.0.1:${sink.httpPort}`
  process.env.E2E_SITE = `http://127.0.0.1:${site.port}`
  process.env.E2E_BERTHA_ENV = JSON.stringify(bertha.env)
  return async () => {
    if (process.env.E2E_SHOW_LOG) console.log(bertha.log())
    await bertha.stop()
    site.close()
    sink.close()
  }
}
