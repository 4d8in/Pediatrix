// Stockage de la file d'attente hors ligne (voir src/lib/outbox.ts). Le contenu contient des données
// de santé : il n'est écrit sur le disque QUE chiffré avec le coffre du système (Electron safeStorage :
// DPAPI sous Windows, trousseau sous macOS/Linux). Si le chiffrement n'est pas réellement protégé
// (Linux sans trousseau : clé en clair), rien n'est écrit et la file reste en mémoire ; l'interface
// en est informée par la valeur de retour de « outbox:save ».
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, ipcMain, safeStorage } from "electron";
import type { IpcMainInvokeEvent } from "electron";

const MAX_BYTES = 5 * 1024 * 1024;

function outboxFile(): string {
  return path.join(app.getPath("userData"), "outbox.bin");
}

// Chiffrement disponible ET adossé à un vrai coffre (pas le mode « basic_text » de Linux).
function canEncrypt(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const backend = (safeStorage as unknown as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend?.();
  return backend !== "basic_text" && backend !== "unknown";
}

// Seule l'interface de l'application peut appeler ces canaux (jamais une page tierce ou une iframe).
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  const dev = process.env.VITE_DEV_SERVER_URL;
  return url.startsWith("app://pediatrix") || (dev !== undefined && url.startsWith(dev));
}

// Une seule écriture à la fois, fichier temporaire unique.
let writeChain: Promise<unknown> = Promise.resolve();
let counter = 0;

export function initOutboxStore(): void {
  ipcMain.handle("outbox:load", async (event): Promise<string | null> => {
    if (!isTrustedSender(event) || !canEncrypt()) return null;
    try {
      const encrypted = await fs.readFile(outboxFile());
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      // Fichier présent mais illisible (clé perdue, profil changé) : mis de côté, jamais écrasé en silence.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await fs.rename(outboxFile(), `${outboxFile()}.corrupt-${Date.now()}`).catch(() => undefined);
      }
      return null;
    }
  });

  ipcMain.handle("outbox:save", async (event, json: unknown): Promise<boolean> => {
    if (!isTrustedSender(event) || typeof json !== "string" || Buffer.byteLength(json, "utf8") > MAX_BYTES) return false;
    if (!canEncrypt()) return false;
    try {
      JSON.parse(json);
    } catch {
      return false;
    }
    const result = writeChain.then(async () => {
      const tmp = `${outboxFile()}.${(counter += 1)}.tmp`;
      await fs.writeFile(tmp, safeStorage.encryptString(json), { mode: 0o600 });
      await fs.rename(tmp, outboxFile());
      return true;
    });
    writeChain = result.catch(() => undefined);
    return result.catch(() => false);
  });
}
