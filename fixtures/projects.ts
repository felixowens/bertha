// Generated fixture — invented data with realistic shape.
import type { Project, ProjectSetup } from "../src/contract/domain"

export const projects: Project[] = [
  {
    "client": "Kiln & Clay Ceramics Ltd",
    "url": "https://kilnandclay.co.uk",
    "repoUrl": "https://github.com/sundial-dev/kiln-and-clay",
    "environments": [
      "production",
      "staging"
    ],
    "id": "p-kiln",
    "key": "KILN",
    "name": "Kiln & Clay",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "new_issues",
    "unresolvedIssues": 29,
    "events24h": 1514,
    "lastEventAt": "2026-10-13T09:11:20Z",
    "monitorIds": [
      "mon-kiln",
      "mon-kiln-checkout"
    ]
  },
  {
    "client": "Harbour Dental Group",
    "url": "https://book.harbourdental.co.uk",
    "repoUrl": "https://gitlab.com/harbour-dental/bookings",
    "environments": [
      "production",
      "staging"
    ],
    "id": "p-harbour",
    "key": "HARB",
    "name": "Harbour Dental bookings",
    "runtimes": [
      "browser",
      "server",
      "edge"
    ],
    "health": "down",
    "unresolvedIssues": 15,
    "events24h": 707,
    "lastEventAt": "2026-10-13T09:11:35Z",
    "monitorIds": [
      "mon-harbour"
    ]
  },
  {
    "client": "Mossgrove Hall",
    "url": "https://enquiries.mossgrovehall.co.uk",
    "repoUrl": "https://github.com/sundial-dev/mossgrove-enquiries",
    "environments": [
      "production"
    ],
    "id": "p-moss",
    "key": "MOSS",
    "name": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "regressed",
    "unresolvedIssues": 14,
    "events24h": 30,
    "lastEventAt": "2026-10-13T08:22:00Z",
    "monitorIds": [
      "mon-moss"
    ]
  },
  {
    "client": null,
    "url": "https://tides.sundial.dev",
    "repoUrl": "https://github.com/sundial-dev/tide-times-api",
    "environments": [
      "production"
    ],
    "id": "p-tides",
    "key": "TIDE",
    "name": "tide-times-api",
    "runtimes": [
      "server"
    ],
    "health": "healthy",
    "unresolvedIssues": 3,
    "events24h": 8,
    "lastEventAt": "2026-10-13T06:09:00Z",
    "monitorIds": [
      "mon-tides"
    ]
  },
  {
    "client": null,
    "url": "https://plot.sundial.dev",
    "repoUrl": "https://github.com/sundial-dev/allotment-planner",
    "environments": [
      "production",
      "development"
    ],
    "id": "p-allot",
    "key": "ALOT",
    "name": "Allotment Planner",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "new_issues",
    "unresolvedIssues": 10,
    "events24h": 7,
    "lastEventAt": "2026-10-13T07:48:00Z",
    "monitorIds": [
      "mon-allot"
    ]
  },
  {
    "client": "St Aidan's Church, Whitby",
    "url": "https://staidans-whitby.org.uk",
    "repoUrl": null,
    "environments": [
      "production"
    ],
    "id": "p-parish",
    "key": "AIDN",
    "name": "St Aidan's newsletter",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 5,
    "events24h": 2,
    "lastEventAt": "2026-10-13T03:39:00Z",
    "monitorIds": [
      "mon-parish"
    ]
  },
  {
    "client": null,
    "url": "https://fieldnotes.sundial.dev",
    "repoUrl": "https://github.com/sundial-dev/fieldnotes",
    "environments": [
      "production"
    ],
    "id": "p-field",
    "key": "FLDN",
    "name": "fieldnotes",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 4,
    "events24h": 1,
    "lastEventAt": "2026-10-10T19:05:00Z",
    "monitorIds": [
      "mon-field"
    ]
  },
  {
    "client": null,
    "url": null,
    "repoUrl": "https://github.com/sundial-dev/invoice-runner",
    "environments": [
      "production"
    ],
    "id": "p-invoice",
    "key": "INVC",
    "name": "Invoice runner",
    "runtimes": [
      "server"
    ],
    "health": "healthy",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": "2026-10-10T15:36:00Z",
    "monitorIds": []
  },
  {
    "client": null,
    "url": "https://sundial.dev",
    "repoUrl": "https://github.com/sundial-dev/sundial.dev",
    "environments": [
      "production"
    ],
    "id": "p-portfolio",
    "key": "SUND",
    "name": "sundial.dev",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": null,
    "monitorIds": [
      "mon-portfolio"
    ]
  },
  {
    "client": null,
    "url": null,
    "repoUrl": null,
    "environments": [
      "production"
    ],
    "id": "p-recipes",
    "key": "RCPE",
    "name": "Recipe box",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "awaiting_first_event",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": null,
    "monitorIds": []
  }
]

export const projectSetups: ProjectSetup[] = [
  {
    "projectId": "p-kiln",
    "ingestKey": "7711956ee7f8d6da7eaf0c97d0ea2a1d",
    "snippets": [
      {
        "label": "Next.js",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment (.env.local and your host). The upload key is secret: CI only.\nNEXT_PUBLIC_BERTHA_KEY=\"7711956ee7f8d6da7eaf0c97d0ea2a1d\"\nNEXT_PUBLIC_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_d1a2ae0d79c0fae7ad6d8f7e\"\n\n# 3. instrumentation.ts\nexport { register, onRequestError } from \"@bigbertha/sdk/next\"\n\n# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n# 5. next.config.ts: releases and source maps\nimport { withBertha } from \"@bigbertha/sdk/next/config\"\nexport default withBertha(nextConfig)\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @vercel/otel\n# instrumentation.ts, in place of step 3\nimport { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"\nimport { otlp, register as bertha } from \"@bigbertha/sdk/next\"\nexport { onRequestError } from \"@bigbertha/sdk/next\"\nexport function register() {\n  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })\n  return bertha()\n}"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"7711956ee7f8d6da7eaf0c97d0ea2a1d\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_d1a2ae0d79c0fae7ad6d8f7e\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2026-08-03T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "2026.10.12-1",
      "uploaded": true
    }
  },
  {
    "projectId": "p-harbour",
    "ingestKey": "40411c8169061d4812c7783a0ce36ea8",
    "snippets": [
      {
        "label": "Next.js",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment (.env.local and your host). The upload key is secret: CI only.\nNEXT_PUBLIC_BERTHA_KEY=\"40411c8169061d4812c7783a0ce36ea8\"\nNEXT_PUBLIC_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_8ae63ec0a3877c2184d16096\"\n\n# 3. instrumentation.ts\nexport { register, onRequestError } from \"@bigbertha/sdk/next\"\n\n# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n# 5. next.config.ts: releases and source maps\nimport { withBertha } from \"@bigbertha/sdk/next/config\"\nexport default withBertha(nextConfig)\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @vercel/otel\n# instrumentation.ts, in place of step 3\nimport { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"\nimport { otlp, register as bertha } from \"@bigbertha/sdk/next\"\nexport { onRequestError } from \"@bigbertha/sdk/next\"\nexport function register() {\n  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })\n  return bertha()\n}"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"40411c8169061d4812c7783a0ce36ea8\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_8ae63ec0a3877c2184d16096\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2025-11-29T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "v2.14.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-moss",
    "ingestKey": "730966a5732705f7fd6bf1994536ae58",
    "snippets": [
      {
        "label": "Next.js",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment (.env.local and your host). The upload key is secret: CI only.\nNEXT_PUBLIC_BERTHA_KEY=\"730966a5732705f7fd6bf1994536ae58\"\nNEXT_PUBLIC_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_85ea6354991fb6df7f507237\"\n\n# 3. instrumentation.ts\nexport { register, onRequestError } from \"@bigbertha/sdk/next\"\n\n# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n# 5. next.config.ts: releases and source maps\nimport { withBertha } from \"@bigbertha/sdk/next/config\"\nexport default withBertha(nextConfig)\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @vercel/otel\n# instrumentation.ts, in place of step 3\nimport { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"\nimport { otlp, register as bertha } from \"@bigbertha/sdk/next\"\nexport { onRequestError } from \"@bigbertha/sdk/next\"\nexport function register() {\n  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })\n  return bertha()\n}"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"730966a5732705f7fd6bf1994536ae58\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_85ea6354991fb6df7f507237\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2026-06-26T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "v3.8.1",
      "uploaded": false
    }
  },
  {
    "projectId": "p-tides",
    "ingestKey": "59c00ae7029bcf957a4e0dce4ac6b439",
    "snippets": [
      {
        "label": "Node",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"59c00ae7029bcf957a4e0dce4ac6b439\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_934b6ca4ecd0e4a759fcb920\"\n\n# 3. First thing your server runs\nimport { init } from \"@bigbertha/sdk/node\"\ninit()\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto\n# Before anything else loads (node --import ./tracing.js)\nimport { NodeSDK } from \"@opentelemetry/sdk-node\"\nimport { getNodeAutoInstrumentations } from \"@opentelemetry/auto-instrumentations-node\"\nimport { OTLPTraceExporter } from \"@opentelemetry/exporter-trace-otlp-proto\"\nimport { otlp } from \"@bigbertha/sdk/node\"\nnew NodeSDK({ traceExporter: new OTLPTraceExporter(otlp()), instrumentations: [getNodeAutoInstrumentations()] }).start()"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"59c00ae7029bcf957a4e0dce4ac6b439\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_934b6ca4ecd0e4a759fcb920\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2025-10-07T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "ca4fda5",
      "uploaded": true
    }
  },
  {
    "projectId": "p-allot",
    "ingestKey": "07f2ba29e0e8eafcf4893f269c7954c0",
    "snippets": [
      {
        "label": "Next.js",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment (.env.local and your host). The upload key is secret: CI only.\nNEXT_PUBLIC_BERTHA_KEY=\"07f2ba29e0e8eafcf4893f269c7954c0\"\nNEXT_PUBLIC_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_0c4597c962f3984fcfae8e0e\"\n\n# 3. instrumentation.ts\nexport { register, onRequestError } from \"@bigbertha/sdk/next\"\n\n# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n# 5. next.config.ts: releases and source maps\nimport { withBertha } from \"@bigbertha/sdk/next/config\"\nexport default withBertha(nextConfig)\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @vercel/otel\n# instrumentation.ts, in place of step 3\nimport { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"\nimport { otlp, register as bertha } from \"@bigbertha/sdk/next\"\nexport { onRequestError } from \"@bigbertha/sdk/next\"\nexport function register() {\n  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })\n  return bertha()\n}"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"07f2ba29e0e8eafcf4893f269c7954c0\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_0c4597c962f3984fcfae8e0e\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2025-10-16T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "27a7795",
      "uploaded": true
    }
  },
  {
    "projectId": "p-parish",
    "ingestKey": "d113dd8d4bda17ad9b3f2934581fad07",
    "snippets": [
      {
        "label": "Vite",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment. The upload key is secret: CI only.\nVITE_BERTHA_KEY=\"d113dd8d4bda17ad9b3f2934581fad07\"\nVITE_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_70daf1854392f3b9da71adb4\"\n\n# 3. main.ts\nimport { init } from \"@bigbertha/sdk/browser\"\ninit({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })\n\n# 4. vite.config.ts: releases and source maps\nimport { bertha } from \"@bigbertha/sdk/vite\"\nplugins: [bertha()]\n\n# After each deploy, in CI\nnpx bertha deploy --env production"
      }
    ],
    "firstEventAt": "2026-04-24T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "1.4.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-field",
    "ingestKey": "39ca4385e19803522a6d4cf527ca4f0b",
    "snippets": [
      {
        "label": "Vite",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment. The upload key is secret: CI only.\nVITE_BERTHA_KEY=\"39ca4385e19803522a6d4cf527ca4f0b\"\nVITE_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_b0f4ac725fc4d6a22530891e\"\n\n# 3. main.ts\nimport { init } from \"@bigbertha/sdk/browser\"\ninit({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })\n\n# 4. vite.config.ts: releases and source maps\nimport { bertha } from \"@bigbertha/sdk/vite\"\nplugins: [bertha()]\n\n# After each deploy, in CI\nnpx bertha deploy --env production"
      }
    ],
    "firstEventAt": "2026-02-16T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "8cddf58",
      "uploaded": true
    }
  },
  {
    "projectId": "p-invoice",
    "ingestKey": "11da5e7701e85db53c19c986c60df8f9",
    "snippets": [
      {
        "label": "Node",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"11da5e7701e85db53c19c986c60df8f9\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_9f8fd06c689c91c35bd58e10\"\n\n# 3. First thing your server runs\nimport { init } from \"@bigbertha/sdk/node\"\ninit()\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto\n# Before anything else loads (node --import ./tracing.js)\nimport { NodeSDK } from \"@opentelemetry/sdk-node\"\nimport { getNodeAutoInstrumentations } from \"@opentelemetry/auto-instrumentations-node\"\nimport { OTLPTraceExporter } from \"@opentelemetry/exporter-trace-otlp-proto\"\nimport { otlp } from \"@bigbertha/sdk/node\"\nnew NodeSDK({ traceExporter: new OTLPTraceExporter(otlp()), instrumentations: [getNodeAutoInstrumentations()] }).start()"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"11da5e7701e85db53c19c986c60df8f9\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_9f8fd06c689c91c35bd58e10\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": "2025-11-29T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "0.9.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-portfolio",
    "ingestKey": "5d748a394c293a30a041c3804e7c548f",
    "snippets": [
      {
        "label": "Vite",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment. The upload key is secret: CI only.\nVITE_BERTHA_KEY=\"5d748a394c293a30a041c3804e7c548f\"\nVITE_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_f845c7e4083c140a03a392c4\"\n\n# 3. main.ts\nimport { init } from \"@bigbertha/sdk/browser\"\ninit({ key: import.meta.env.VITE_BERTHA_KEY, url: import.meta.env.VITE_BERTHA_URL })\n\n# 4. vite.config.ts: releases and source maps\nimport { bertha } from \"@bigbertha/sdk/vite\"\nplugins: [bertha()]\n\n# After each deploy, in CI\nnpx bertha deploy --env production"
      }
    ],
    "firstEventAt": "2026-07-02T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "37728ef",
      "uploaded": true
    }
  },
  {
    "projectId": "p-recipes",
    "ingestKey": "767cefad9628071235852c19b2c6949e",
    "snippets": [
      {
        "label": "Next.js",
        "code": "# 1. Install the SDK\nnpm install @bigbertha/sdk\n\n# 2. Environment (.env.local and your host). The upload key is secret: CI only.\nNEXT_PUBLIC_BERTHA_KEY=\"767cefad9628071235852c19b2c6949e\"\nNEXT_PUBLIC_BERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_e9496c2b91c2585321708269\"\n\n# 3. instrumentation.ts\nexport { register, onRequestError } from \"@bigbertha/sdk/next\"\n\n# 4. instrumentation-client.ts\nexport { onRouterTransitionStart } from \"@bigbertha/sdk/next/client\"\n\n# 5. next.config.ts: releases and source maps\nimport { withBertha } from \"@bigbertha/sdk/next/config\"\nexport default withBertha(nextConfig)\n\n# After each deploy, in CI\nnpx bertha deploy --env production\n\n# Optional: traces, so an error shows what its request did across your services\nnpm install @vercel/otel\n# instrumentation.ts, in place of step 3\nimport { OTLPHttpProtoTraceExporter, registerOTel } from \"@vercel/otel\"\nimport { otlp, register as bertha } from \"@bigbertha/sdk/next\"\nexport { onRequestError } from \"@bigbertha/sdk/next\"\nexport function register() {\n  registerOTel({ traceExporter: new OTLPHttpProtoTraceExporter(otlp()) })\n  return bertha()\n}"
      },
      {
        "label": "Rust",
        "code": "# 1. Install the SDK\ncargo add bigbertha --features tracing,tower,anyhow\n\n# 2. Environment. The upload key is secret: CI only.\nBERTHA_KEY=\"767cefad9628071235852c19b2c6949e\"\nBERTHA_URL=\"https://bertha.sundial.dev\"\nBERTHA_UPLOAD_KEY=\"bu_e9496c2b91c2585321708269\"\n# So anyhow errors carry where they came from\nRUST_LIB_BACKTRACE=1\n\n# 3. main.rs, first thing. Keep the guard until main returns.\nlet _bertha = bigbertha::init(bigbertha::options!());\ntracing_subscriber::registry().with(fmt::layer()).with(bigbertha::tracing::layer()).init();\n\n# 4. Your router: the request on every error, and panics as 500s\nlet app = Router::new().route(\"/\", get(home)).layer(bigbertha::tower::layer());\n\n# 5. Cargo.toml: file and line numbers in release builds\n[profile.release]\ndebug = \"line-tables-only\"\n\n# After each deploy, in CI\nnpx @bigbertha/sdk deploy --env production"
      }
    ],
    "firstEventAt": null,
    "sourceMaps": {
      "latestRelease": null,
      "uploaded": false
    }
  }
]

/** Project briefs, by project id: what anyone triaging should know first. */
export const briefs: Record<string, string> = {
  "p-kiln": `Next.js 15 shop on Vercel, Shopify Storefront API behind it. Repo: sundial/kiln.

- The basket API answers **204** for an empty basket, not \`{ lines: [] }\`.
- \`ResizeObserver loop\` errors are browser noise. Leave them ignored.
- Deploys go out from \`main\` several times a day; \`-rc\` releases are staging.`,
  "p-moss": `Astro site on Netlify for the wedding venue. Enquiries post to a Netlify function that emails the office.

Safari cancels prefetches on navigation and reports them as \`Failed to fetch\`. Check the stack for \`prefetch\` before anything else.`,
}
