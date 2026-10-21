//! The copy-paste setup shown when a project is created and in its settings.

use crate::domain::{Runtime, SetupSnippet};

/// The optional OpenTelemetry step. bertha keeps a trace's spans when an error names it.
const NEXT_TRACES: &str = "\
# Optional: traces, so an error shows what its request did across your services
npm install @vercel/otel
# instrumentation.ts, in place of step 3
import { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"
import { otlp, register as bertha } from \"@bigbertha/sdk/next\"
export { onRequestError } from \"@bigbertha/sdk/next\"
export function register() {
  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })
  return bertha()
}";

const NODE_TRACES: &str = "\
# Optional: traces, so an error shows what its request did across your services
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
# Before anything else loads (node --import ./tracing.js)
import { NodeSDK } from \"@opentelemetry/sdk-node\"
import { getNodeAutoInstrumentations } from \"@opentelemetry/auto-instrumentations-node\"
import { OTLPTraceExporter } from \"@opentelemetry/exporter-trace-otlp-proto\"
import { otlp } from \"@bigbertha/sdk/node\"
new NodeSDK({ traceExporter: new OTLPTraceExporter(otlp()), instrumentations: [getNodeAutoInstrumentations()] }).start()";

/// Setup for a project's runtimes: the JavaScript SDK first, then Rust for servers.
pub fn snippets(runtimes: &[Runtime], ingest_key: &str, upload_key: &str, url: &str) -> Vec<SetupSnippet> {
    let (label, code) = javascript(runtimes, ingest_key, upload_key, url);
    let mut all = vec![SetupSnippet { label: label.to_owned(), code }];
    if runtimes.contains(&Runtime::Server) {
        all.push(SetupSnippet { label: "Rust".to_owned(), code: rust(ingest_key, upload_key, url) });
    }
    all
}

/// The `bigbertha` crate: a server, most likely axum, logging with `tracing`.
fn rust(ingest_key: &str, upload_key: &str, url: &str) -> String {
    format!(
        "# 1. Install the SDK\n\
         cargo add bigbertha --features tracing,tower,anyhow\n\n\
         # 2. Environment. The upload key is secret: CI only.\n\
         BERTHA_KEY=\"{ingest_key}\"\n\
         BERTHA_URL=\"{url}\"\n\
         BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\
         # So anyhow errors carry where they came from\n\
         RUST_LIB_BACKTRACE=1\n\n\
         # 3. main.rs, first thing. Keep the guard until main returns.\n\
         let _bertha = bigbertha::init(bigbertha::options!());\n\
         tracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n\
         # 4. Your router: the request on every error, and panics as 500s\n\
         let app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n\
         # 5. Cargo.toml: file and line numbers in release builds\n\
         [profile.release]\n\
         debug = \"line-tables-only\"\n\n\
         # After each deploy, in CI\n\
         npx @bigbertha/sdk deploy --env production"
    )
}

/// The JavaScript SDK, and what it sets up. Browser + server (or edge) is taken to be a
/// Next.js app; browser alone a Vite app; server alone a Node service.
fn javascript(runtimes: &[Runtime], ingest_key: &str, upload_key: &str, url: &str) -> (&'static str, String) {
    let browser = runtimes.contains(&Runtime::Browser);
    let server = runtimes.contains(&Runtime::Server);
    let edge = runtimes.contains(&Runtime::Edge);
    let mut s = String::from("# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n");
    let label = if edge || (browser && server) {
        s += &format!(
            "# 2. Environment (.env.local and your host). The upload key is secret: CI only.\n\
             NEXT_PUBLIC_BERTHA_KEY=\"{ingest_key}\"\n\
             NEXT_PUBLIC_BERTHA_URL=\"{url}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. instrumentation.ts\n\
             export {{ register, onRequestError }} from \"@bigbertha/sdk/next\"\n\n"
        );
        if browser {
            s += "# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n";
        }
        s += &format!(
            "# {}. next.config.ts: releases and source maps\n\
             import {{ withBertha }} from \"@bigbertha/sdk/next/config\"\n\
             export default withBertha(nextConfig)\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production\n\n{NEXT_TRACES}",
            if browser { 5 } else { 4 }
        );
        "Next.js"
    } else if browser {
        s += &format!(
            "# 2. Environment. The upload key is secret: CI only.\n\
             VITE_BERTHA_KEY=\"{ingest_key}\"\n\
             VITE_BERTHA_URL=\"{url}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. main.ts\n\
             import {{ init }} from \"@bigbertha/sdk/browser\"\n\
             init({{ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL }})\n\n\
             # 4. vite.config.ts: releases and source maps\n\
             import {{ bertha }} from \"@bigbertha/sdk/vite\"\n\
             plugins: [bertha()]\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production"
        );
        "Vite"
    } else {
        s += &format!(
            "# 2. Environment. The upload key is secret: CI only.\n\
             BERTHA_KEY=\"{ingest_key}\"\n\
             BERTHA_URL=\"{url}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. First thing your server runs\n\
             import {{ init }} from \"@bigbertha/sdk/node\"\n\
             init()\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production\n\n{NODE_TRACES}"
        );
        "Node"
    };
    (label, s)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snippet(runtimes: &[Runtime], ingest_key: &str, upload_key: &str, url: &str) -> String {
        snippets(runtimes, ingest_key, upload_key, url).remove(0).code
    }

    #[test]
    fn rust_for_servers() {
        let labels =
            |r: &[Runtime]| snippets(r, "bk", "bu", "https://b.dev").into_iter().map(|s| s.label).collect::<Vec<_>>();
        assert_eq!(labels(&[Runtime::Browser, Runtime::Server]), ["Next.js", "Rust"]);
        assert_eq!(labels(&[Runtime::Edge]), ["Next.js"]);
        assert_eq!(labels(&[Runtime::Browser]), ["Vite"]);
        assert_eq!(labels(&[Runtime::Server]), ["Node", "Rust"]);
        let rust = snippets(&[Runtime::Server], "bk", "bu", "https://b.dev").remove(1).code;
        assert!(
            rust.contains("cargo add bigbertha")
                && rust.contains("BERTHA_KEY=\"bk\"")
                && rust.contains("BERTHA_UPLOAD_KEY=\"bu\"")
        );
        assert!(rust.contains("bigbertha::tower::layer()") && rust.contains("bigbertha::tracing::layer()"));
    }

    #[test]
    fn picks_the_framework_from_runtimes() {
        let next = snippet(&[Runtime::Browser, Runtime::Server], "bk", "bu", "https://b.dev");
        assert!(next.contains("@bigbertha/sdk/next/client") && next.contains("NEXT_PUBLIC_BERTHA_KEY=\"bk\""));
        let vite = snippet(&[Runtime::Browser], "bk", "bu", "https://b.dev");
        assert!(vite.contains("@bigbertha/sdk/vite") && !vite.contains("next"));
        assert!(vite.contains("VITE_BERTHA_URL=\"https://b.dev\"") && vite.contains("import.meta.env.VITE_BERTHA_URL"));
        assert!(next.contains("export { onRouterTransitionStart }"));
        let node = snippet(&[Runtime::Server], "bk", "bu", "https://b.dev");
        assert!(node.contains("@bigbertha/sdk/node") && node.contains("BERTHA_UPLOAD_KEY=\"bu\""));
        assert!(next.contains("new OTLPHttpProtoTraceExporter(otlp())"), "{next}");
        assert!(node.contains("new OTLPTraceExporter(otlp())"), "{node}");
        assert!(!vite.contains("Optional: traces"), "the browser sends its spans by itself");
    }
}
