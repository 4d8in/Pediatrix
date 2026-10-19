// Pont minimal entre l'interface React et le processus principal :
// seule l'API de mise à jour est exposée (pas d'accès Node.js dans l'UI).
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { UpdateStatus } from "../src/lib/update-status";

// File d'attente hors ligne : le contenu est chiffré par le processus principal (voir main.ts).
contextBridge.exposeInMainWorld("pediatrixOutbox", {
  load(): Promise<string | null> {
    return ipcRenderer.invoke("outbox:load");
  },
  save(json: string): Promise<boolean> {
    return ipcRenderer.invoke("outbox:save", json);
  },
});

contextBridge.exposeInMainWorld("pediatrixUpdater", {
  onStatus(callback: (status: UpdateStatus) => void): () => void {
    const listener = (_event: IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
  getStatus(): Promise<UpdateStatus> {
    return ipcRenderer.invoke("updater:get-status");
  },
  installNow(): Promise<void> {
    return ipcRenderer.invoke("updater:install");
  },
});
