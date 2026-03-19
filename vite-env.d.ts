/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Colyseus WebSocket server URL. */
  readonly VITE_SERVER_URL: string | undefined;
  /** Firebase configuration. */
  readonly VITE_FIREBASE_API_KEY: string | undefined;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string | undefined;
  readonly VITE_FIREBASE_PROJECT_ID: string | undefined;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string | undefined;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string | undefined;
  readonly VITE_FIREBASE_APP_ID: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
