/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // You can add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}