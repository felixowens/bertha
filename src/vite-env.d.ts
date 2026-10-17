/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `http` points the dev server at the real API instead of the fixtures. */
  readonly VITE_BACKEND?: "http" | "fixtures"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
