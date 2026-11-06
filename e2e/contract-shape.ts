// Holds a JSON value to a type in `src/contract`, read with the TypeScript compiler, so
// the contract is the only description of the shape and nothing can drift from it. Stricter
// than TypeScript on purpose: a field the contract doesn't name is an error, and so is
// `null` where a field may only be left out.

import { resolve } from "node:path"
import ts from "typescript"

const CONTRACT = resolve(import.meta.dirname, "../src/contract")

export type Contract = {
  /** What a `Backend` method resolves to. */
  replyOf: (method: string) => ts.Type
  /** An exported type, by name. */
  named: (file: "domain" | "pages" | "actions", name: string) => ts.Type
  /** What's wrong with `value` as `type`, one line each; empty when it fits. */
  check: (type: ts.Type, value: unknown, root: string) => string[]
}

const isUndefined = (t: ts.Type) => (t.flags & ts.TypeFlags.Undefined) !== 0

export function loadContract(): Contract {
  const files = ["domain", "pages", "actions"].map((f) => resolve(CONTRACT, `${f}.ts`))
  const program = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  })
  const checker = program.getTypeChecker()

  const named: Contract["named"] = (file, name) => {
    const source = program.getSourceFile(resolve(CONTRACT, `${file}.ts`))!
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).find((s) => s.name === name)
    if (!symbol) throw new Error(`src/contract/${file}.ts doesn't export ${name}.`)
    return checker.getDeclaredTypeOfSymbol(symbol)
  }

  const replyOf: Contract["replyOf"] = (method) => {
    const member = checker.getPropertyOfType(named("actions", "Backend"), method)
    if (!member) throw new Error(`Backend has no method ${method}.`)
    const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(member), ts.SignatureKind.Call)
    return checker.getTypeArguments(checker.getReturnTypeOfSignature(signature) as ts.TypeReference)[0]
  }

  const isBoolean = (t: ts.Type) => (t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) !== 0
  const propsOf = (t: ts.Type) => checker.getPropertiesOfType(t)
  const typeOfProp = (p: ts.Symbol) => checker.getTypeOfSymbol(p)
  const isOptional = (p: ts.Symbol) => (p.flags & ts.SymbolFlags.Optional) !== 0

  const members = (t: ts.UnionType) => {
    const out = t.types.filter((m) => !isUndefined(m))
    // `boolean` is `true | false` to the compiler; one branch is enough.
    return out.filter((m, i) => !isBoolean(m) || out.findIndex(isBoolean) === i)
  }

  const describe = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "an array" : typeof v === "object" ? "an object" : JSON.stringify(v))

  const walk = (t: ts.Type, v: unknown, path: string): string[] => {
    const f = t.flags
    const want = (ok: boolean) => (ok ? [] : [`${path}: expected ${checker.typeToString(t)}, got ${describe(v)}`])
    if (f & ts.TypeFlags.Any) return [`${path}: the contract says any, which can't be checked`]
    if (f & ts.TypeFlags.Unknown) return []
    if (f & ts.TypeFlags.Boolean || f & ts.TypeFlags.BooleanLiteral) {
      if (t.flags & ts.TypeFlags.BooleanLiteral) return want(v === (checker.typeToString(t) === "true"))
      return want(typeof v === "boolean")
    }
    if (f & ts.TypeFlags.Union) {
      const options = members(t as ts.UnionType)
      let closest: string[] | null = null
      for (const m of options) {
        const wrong = isBoolean(m) ? (typeof v === "boolean" ? [] : [`${path}: expected boolean, got ${describe(v)}`]) : walk(m, v, path)
        if (!wrong.length) return []
        if (!closest || wrong.length < closest.length) closest = wrong
      }
      return closest ?? [`${path}: no branch fits ${describe(v)}`]
    }
    if (f & ts.TypeFlags.String) return want(typeof v === "string")
    if (f & ts.TypeFlags.Number) return want(typeof v === "number")
    if (f & ts.TypeFlags.Null) return want(v === null)
    if (f & ts.TypeFlags.Undefined) return want(v === undefined)
    if (f & ts.TypeFlags.StringLiteral) return want(v === (t as ts.StringLiteralType).value)
    if (f & ts.TypeFlags.NumberLiteral) return want(v === (t as ts.NumberLiteralType).value)
    if (f & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) {
      if (checker.isArrayType(t)) {
        if (!Array.isArray(v)) return want(false)
        const [item] = checker.getTypeArguments(t as ts.TypeReference)
        return v.flatMap((x, i) => walk(item, x, `${path}[${i}]`))
      }
      if (checker.isTupleType(t)) {
        const items = checker.getTypeArguments(t as ts.TypeReference)
        if (!Array.isArray(v) || v.length !== items.length) return want(false)
        return items.flatMap((item, i) => walk(item, v[i], `${path}[${i}]`))
      }
      if (v === null || typeof v !== "object" || Array.isArray(v)) return want(false)
      const value = v as Record<string, unknown>
      const known = new Set<string>()
      const errors: string[] = []
      for (const p of propsOf(t)) {
        known.add(p.name)
        if (value[p.name] === undefined) {
          if (!isOptional(p)) errors.push(`${path}.${p.name}: missing`)
          continue
        }
        errors.push(...walk(typeOfProp(p), value[p.name], `${path}.${p.name}`))
      }
      const index = checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & ts.TypeFlags.String)
      for (const k of Object.keys(value)) {
        if (known.has(k)) continue
        if (index) errors.push(...walk(index.type, value[k], `${path}.${k}`))
        else errors.push(`${path}.${k}: the contract has no such field`)
      }
      return errors
    }
    throw new Error(`${path}: this check doesn't understand ${checker.typeToString(t)}. Teach e2e/contract-shape.ts.`)
  }

  return {
    named,
    replyOf,
    check: (type, value, root) => walk(type, value, root),
  }
}
