// Stockage de la file d'attente hors ligne (voir src/lib/outbox.ts). Le contenu contient des données
// de santé : il n'est écrit sur le disque QUE chiffré avec le coffre du système (Electron safeStorage :
// DPAPI sous Windows, trousseau sous macOS/Linux). Si le chiffrement n'est pas disponible, rien n'est
// écrit et la file reste en mémoire (l'interface en est informée).
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, ipcMain, safeStorage } from "electron";

const MAX_BYTES = 5 * 1024 * 1024;

function outboxFile(): string {
  return path.join(app.getPath("userData"), "outbox.bin");
}

export function initOutboxStore(): void {
  ipcMain.handle("outbox:load", async (): Promise<string | null> => {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      const encrypted = await fs.readFile(outboxFile());
      return safeStorage.decryptString(encrypted);
    } catch {
      return null;
    }
  });

  ipcMain.handle("outbox:save", async (_event, json: unknown): Promise<boolean> => {
    if (typeof json !== "string" || json.length > MAX_BYTES) return false;
    if (!safeStorage.isEncryptionAvailable()) return false;
    try {
      const tmp = `${outboxFile()}.tmp`;
      await fs.writeFile(tmp, safeStorage.encryptString(json), { mode: 0o600 });
      await fs.rename(tmp, outboxFile());
      return true;
    } catch {
      return false;
    }
  });
}
