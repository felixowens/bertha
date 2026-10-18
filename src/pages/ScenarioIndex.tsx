import { scenarioHref, scenarios } from "@/data/scenario"
import { Wordmark } from "@/components/shell/Wordmark"
import { Mono } from "@/components/ui/primitives"

/** Every named scenario, one link each. A designer's index, not a product page. */
export function ScenarioIndex() {
  const routes = [...new Set(scenarios.map((s) => s.route))]
  return (
    <main className="min-h-svh bg-background px-6 py-10 md:px-12">
      <Wordmark />
      <h1 className="mt-8 text-xl font-medium text-foreground">Scenarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every named state. Generic ones too: <Mono>?scenario=loading</Mono>, <Mono>empty</Mono>, <Mono>error</Mono>.
      </p>
      <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {routes.map((r) => (
          <section key={r}>
            <Mono className="text-xs text-faint">{r}</Mono>
            <ul className="mt-2 border-t border-hairline">
              {scenarios
                .filter((s) => s.route === r)
                .map((s) => (
                  <li key={s.id} className="border-b border-hairline py-2">
                    <a href={scenarioHref(s)} className="block text-sm text-foreground underline-fade">
                      {s.id}
                    </a>
                    <p className="text-xs text-faint">{s.description}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
