//! The copy-paste setup shown when a project is created and in its settings.

use crate::domain::Runtime;

/// Setup steps for a project's runtimes. Browser + server (or edge) is taken to be a
/// Next.js app; browser alone a Vite app; server alone a Node service.
pub fn snippet(runtimes: &[Runtime], ingest_key: &str, upload_key: &str, url: &str) -> String {
    let browser = runtimes.contains(&Runtime::Browser);
    let server = runtimes.contains(&Runtime::Server);
    let edge = runtimes.contains(&Runtime::Edge);
    let mut s = String::from("# 1. Install the SDK\nnpm install @bertha/sdk\n\n");
    if edge || (browser && server) {
        s += &format!(
            "# 2. Environment (.env.local and your host). The upload key is secret: CI only.\n\
             NEXT_PUBLIC_BERTHA_KEY=\"{ingest_key}\"\n\
             NEXT_PUBLIC_BERTHA_URL=\"{url}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. instrumentation.ts\n\
             export {{ register, onRequestError }} from \"@bertha/sdk/next\"\n\n"
        );
        if browser {
            s += "# 4. instrumentation-client.ts\nimport \"@bertha/sdk/next/client\"\n\n";
        }
        s += &format!(
            "# {}. next.config.ts: releases and source maps\n\
             import {{ withBertha }} from \"@bertha/sdk/next/config\"\n\
             export default withBertha(nextConfig)\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production",
            if browser { 5 } else { 4 }
        );
    } else if browser {
        s += &format!(
            "# 2. Environment. The upload key is secret: CI only.\n\
             VITE_BERTHA_KEY=\"{ingest_key}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. main.ts\n\
             import {{ init }} from \"@bertha/sdk/browser\"\n\
             init({{ key: import.meta.env.VITE_BERTHA_KEY, url: \"{url}\" }})\n\n\
             # 4. vite.config.ts: releases and source maps\n\
             import {{ bertha }} from \"@bertha/sdk/vite\"\n\
             plugins: [bertha()]\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production"
        );
    } else {
        s += &format!(
            "# 2. Environment. The upload key is secret: CI only.\n\
             BERTHA_KEY=\"{ingest_key}\"\n\
             BERTHA_URL=\"{url}\"\n\
             BERTHA_UPLOAD_KEY=\"{upload_key}\"\n\n\
             # 3. First thing your server runs\n\
             import {{ init }} from \"@bertha/sdk/node\"\n\
             init()\n\n\
             # After each deploy, in CI\n\
             npx bertha deploy --env production"
        );
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_the_framework_from_runtimes() {
        let next = snippet(&[Runtime::Browser, Runtime::Server], "bk", "bu", "https://b.dev");
        assert!(next.contains("@bertha/sdk/next/client") && next.contains("NEXT_PUBLIC_BERTHA_KEY=\"bk\""));
        let vite = snippet(&[Runtime::Browser], "bk", "bu", "https://b.dev");
        assert!(vite.contains("@bertha/sdk/vite") && !vite.contains("next"));
        let node = snippet(&[Runtime::Server], "bk", "bu", "https://b.dev");
        assert!(node.contains("@bertha/sdk/node") && node.contains("BERTHA_UPLOAD_KEY=\"bu\""));
    }
}
