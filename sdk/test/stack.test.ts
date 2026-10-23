import { describe, expect, it } from "vitest"

import { parseStack } from "../src/core/stack.ts"

describe("parseStack", () => {
  it("reads V8 stacks", () => {
    const stack = `TypeError: Cannot read properties of undefined (reading 'price')
    at sumLines (https://shop.test/assets/index-4f9a.js:1:200)
    at async Object.renderCart [as render] (https://shop.test/assets/index-4f9a.js:1:100)
    at new Cart (/app/src/cart.js:9:3)
    at https://shop.test/assets/index-4f9a.js:2:5
    at Array.map (<anonymous>)
    at Module._compile (node:internal/modules/cjs/loader:1554:14)
    at Object.<anonymous> (/app/node_modules/react/index.js:3:1)`
    expect(parseStack(stack)).toEqual([
      { file: "https://shop.test/assets/index-4f9a.js", function: "sumLines", line: 1, column: 200 },
      { file: "https://shop.test/assets/index-4f9a.js", function: "Object.renderCart", line: 1, column: 100 },
      { file: "/app/src/cart.js", function: "Cart", line: 9, column: 3 },
      { file: "https://shop.test/assets/index-4f9a.js", line: 2, column: 5 },
      { file: "node:internal/modules/cjs/loader", function: "Module._compile", line: 1554, column: 14, inApp: false },
      { file: "/app/node_modules/react/index.js", line: 3, column: 1, inApp: false },
    ])
  })

  it("keeps only the file of an unnamed async frame", () => {
    const stack = `AssertionError: The second argument to whereBetween must be an array.
    at Builder.whereBetween (/app/node_modules/knex/lib/query/querybuilder.js:812:13)
    at async /app/src/middlewares/legacy-http.js:151:5
    at async Object.find [as find] (/app/src/api/faq/controllers/faq.js:9:20)`
    expect(parseStack(stack)).toEqual([
      { file: "/app/node_modules/knex/lib/query/querybuilder.js", function: "Builder.whereBetween", line: 812, column: 13, inApp: false },
      { file: "/app/src/middlewares/legacy-http.js", line: 151, column: 5 },
      { file: "/app/src/api/faq/controllers/faq.js", function: "Object.find", line: 9, column: 20 },
    ])
  })

  it("reads Firefox and Safari stacks", () => {
    const stack = `sumLines@https://shop.test/assets/index.js:1:200
renderCart/<@https://shop.test/assets/index.js:1:100
@https://shop.test/assets/index.js:2:5
[native code]`
    expect(parseStack(stack)).toEqual([
      { file: "https://shop.test/assets/index.js", function: "sumLines", line: 1, column: 200 },
      { file: "https://shop.test/assets/index.js", function: "renderCart/<", line: 1, column: 100 },
      { file: "https://shop.test/assets/index.js", line: 2, column: 5 },
    ])
  })

  it("keeps the outer file for eval frames", () => {
    const stack = "Error: x\n    at eval (eval at run (https://a.test/app.js:3:9), <anonymous>:1:1)"
    expect(parseStack(stack)[0]?.file).toBe("https://a.test/app.js")
  })

  it("marks extension and masked frames as not the app's", () => {
    const stack = `@webkit-masked-url://hidden/:2:107183
run@safari-web-extension://8a1b/content.js:1:5
x@chrome-extension://abcd/inject.js:3:1
y@moz-extension://ef01/page.js:4:2
z@https://shop.test/assets/index.js:1:1`
    expect(parseStack(stack).map((f) => f.inApp)).toEqual([false, false, false, false, undefined])
  })

  it("keeps Safari's frames in code with no URL, as not the app's", () => {
    const stack = `paste@
global code@
forEach@[native code]
run@https://shop.test/assets/index.js:1:1`
    expect(parseStack(stack)).toEqual([
      { file: "<anonymous>", function: "paste", inApp: false },
      { file: "<anonymous>", function: "global code", inApp: false },
      { file: "https://shop.test/assets/index.js", function: "run", line: 1, column: 1 },
    ])
  })

  it("doesn't read a message that ends in @ as a frame", () => {
    expect(parseStack("Error: No account for bob@\n    at f (https://a.test/app.js:1:2)")).toHaveLength(1)
  })

  it("handles nothing", () => {
    expect(parseStack(undefined)).toEqual([])
    expect(parseStack("just a message")).toEqual([])
  })

  it("reads this runtime's own stacks", () => {
    const frames = parseStack(new Error("here").stack)
    expect(frames[0]?.file).toContain("stack.test.ts")
  })
})
