/// <reference types="vite/client" />

import type { UpdateStatus } from "./lib/update-status";

// API exposée par electron/preload.ts (absente quand l'UI tourne dans un navigateur).
declare global {
  interface Window {
    pediatrixUpdater?: {
      onStatus(callback: (status: UpdateStatus) => void): () => void;
      getStatus(): Promise<UpdateStatus>;
      installNow(): Promise<void>;
    };
  }
}
