/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENOR_API_KEY?: string;
  readonly VITE_TENOR_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
