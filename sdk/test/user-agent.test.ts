import { expect, it } from "vitest"

import { userAgent } from "../src/browser/user-agent.ts"

it("names the browser and OS", () => {
  const cases: [string, { browser?: string; os?: string }][] = [
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      { browser: "Chrome 141", os: "macOS 10.15" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      { browser: "Safari 18", os: "iOS 18" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
      { browser: "Firefox 144", os: "Windows 10+" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      { browser: "Edge 141", os: "Windows 10+" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome 141", os: "Android 15" },
    ],
  ]
  for (const [ua, expected] of cases) expect(userAgent(ua)).toEqual(expected)
})
