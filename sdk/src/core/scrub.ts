// On by default: no email addresses, bearer tokens or secret-looking query values
// leave the app. The rules are bigbertha's (generated/policy.ts), so both SDKs scrub
// alike. Turn off with `scrub: false`.

import * as policy from "../generated/policy.ts"

const EMAIL = new RegExp(policy.EMAIL, "g")
const BEARER = new RegExp(policy.BEARER, "gi")
const SECRET_PARAM = new RegExp(policy.SECRET_PARAM, "gi")
const SENSITIVE_KEY = new RegExp(policy.SENSITIVE_KEY, "i")

export function scrubText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(BEARER, "$1 [redacted]").replace(SECRET_PARAM, "$1[redacted]")
}

export function scrubUrl(url: string): string {
  return url.replace(SECRET_PARAM, "$1[redacted]")
}

/** Fields whose names say they hold a secret are dropped, and the rest scrubbed. */
export function scrubFields(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([k]) => !SENSITIVE_KEY.test(k))
      .map(([k, v]) => [k, scrubText(v)]),
  )
}
