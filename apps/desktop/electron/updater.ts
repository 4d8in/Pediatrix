// Module de mise à jour : electron-updater avec la source "generic".
// Les fichiers de version (latest.yml, latest-linux.yml + installeurs) sont
// servis par le backend Pédiatrix sur le LAN (route GET /updates/:file) :
// aucune connexion Internet n'est nécessaire (offline-first).
import { app, ipcMain, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "../src/lib/update-status";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 15 * 1000;

// URL du dossier de mises à jour. Priorité à la variable d'environnement du
// poste, sinon le backend par défaut (même valeur que VITE_BACKEND_URL au build).
const UPDATE_URL =
  process.env.PEDIATRIX_UPDATE_URL?.trim() ||
  `${import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001"}/updates`;

let status: UpdateStatus = { state: "idle" };

export function initUpdater(win: BrowserWindow): void {
  function setStatus(next: UpdateStatus): void {
    status = next;
    if (!win.isDestroyed()) win.webContents.send("updater:status", status);
  }

  ipcMain.handle("updater:get-status", () => status);
  ipcMain.handle("updater:install", () => {
    if (status.state === "ready") autoUpdater.quitAndInstall();
  });

  // En dev (application non empaquetée), pas de vérification.
  if (!app.isPackaged) return;

  autoUpdater.setFeedURL({ provider: "generic", url: UPDATE_URL });
  autoUpdater.autoDownload = true;
  // Si l'utilisateur ne clique pas « Redémarrer », la mise à jour
  // s'installe à la fermeture de l'application.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => setStatus({ state: "checking" }));
  autoUpdater.on("update-not-available", () => setStatus({ state: "up-to-date" }));
  autoUpdater.on("update-available", (info) => setStatus({ state: "downloading", version: info.version, percent: 0 }));
  autoUpdater.on("download-progress", (progress) => {
    const version = status.state === "downloading" ? status.version : "";
    setStatus({ state: "downloading", version, percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => setStatus({ state: "ready", version: info.version }));
  // Backend injoignable ou pas de fichier de version : on le signale sans
  // bloquer l'application, la prochaine vérification réessaiera.
  autoUpdater.on("error", (error) => setStatus({ state: "error", message: error.message }));

  const check = () => {
    autoUpdater.checkForUpdates().catch(() => {
      // Déjà remonté via l'évènement "error".
    });
  };
  setTimeout(check, INITIAL_DELAY_MS);
  setInterval(check, CHECK_INTERVAL_MS);
}
