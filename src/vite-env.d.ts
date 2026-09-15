/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 플러그인 빌드 시 박아 넣는 relay-service 주소. */
  readonly VITE_RELAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
