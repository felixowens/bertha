# Examples

Small apps that throw on purpose, wired up the way the setup page says. `npm run e2e`
in `sdk/` builds bertha, runs it on a temporary database and checks each example's
errors arrive with mapped stacks.

- `node-app`: a Node service bundled with esbuild.
- `vite-app`: a Vite browser app.
- `next-app`: a Next.js app (App Router), server and browser.

To try one by hand, `npm install` in its folder and set the variables from the
project's setup page.
