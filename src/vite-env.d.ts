/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `http` points the dev server at the real API instead of the fixtures. */
  readonly VITE_BACKEND?: "http" | "fixtures"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The bertha release this app was built for, e.g. "0.1.9". */
declare const __BERTHA_VERSION__: string
