// On by default: no email addresses, bearer tokens or secret-looking query values
// leave the app. Turn off with `scrub: false`.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const BEARER = /\b(Bearer|Basic)\s+[\w.~+/=-]+/gi
const SECRET_PARAM = /([?&](?:[^=&#]*(?:token|key|secret|password|passwd|auth|session|code|sig)[^=&#]*)=)[^&#\s]*/gi

export function scrubText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(BEARER, "$1 [redacted]").replace(SECRET_PARAM, "$1[redacted]")
}

export function scrubUrl(url: string): string {
  return url.replace(SECRET_PARAM, "$1[redacted]")
}
