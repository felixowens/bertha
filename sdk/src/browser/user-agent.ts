// Just enough user-agent reading to tag events by browser and OS.

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/Firefox\/(\d+)/, "Firefox"],
  [/FxiOS\/(\d+)/, "Firefox"],
  [/CriOS\/(\d+)/, "Chrome"],
  [/Chrome\/(\d+)/, "Chrome"],
  [/Version\/(\d+)(?:\.\d+)?.*Safari/, "Safari"],
]

export function userAgent(ua: string): { browser?: string; os?: string } {
  const out: { browser?: string; os?: string } = {}
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua)
    if (m) {
      out.browser = `${name} ${m[1]}`
      break
    }
  }
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d+)/.exec(ua)
  const android = /Android (\d+)/.exec(ua)
  const mac = /Mac OS X (\d+)[._](\d+)/.exec(ua)
  const win = /Windows NT (\d+\.\d+)/.exec(ua)
  if (ios) out.os = `iOS ${ios[1]}`
  else if (android) out.os = `Android ${android[1]}`
  else if (win) out.os = win[1] === "10.0" ? "Windows 10+" : `Windows NT ${win[1]}`
  else if (mac) out.os = `macOS ${mac[1] === "10" ? `10.${mac[2]}` : mac[1]}`
  else if (/CrOS/.test(ua)) out.os = "ChromeOS"
  else if (/Linux/.test(ua)) out.os = "Linux"
  return out
}
