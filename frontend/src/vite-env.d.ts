/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, default `/api/v1` (same-origin through the dev proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
