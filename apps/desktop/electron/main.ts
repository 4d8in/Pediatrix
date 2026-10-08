// Processus principal Electron : coquille minimale.
// Toute la logique métier reste dans le backend Node.js (apps/backend) :
// ce fichier se contente d'ouvrir la fenêtre et de brancher les mises à jour.
import path from "node:path";
import { app, BrowserWindow, Menu, net, protocol, shell } from "electron";
import { pathToFileURL } from "node:url";
import { initUpdater } from "./updater";

// En dev, vite-plugin-electron fournit l'URL du serveur Vite.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(__dirname, "../dist");

// En production, l'interface est servie via un protocole dédié "app://pediatrix"
// plutôt que file:// : l'origine est ainsi stable et peut être autorisée
// explicitement par le CORS du backend (file:// enverrait l'origine "null").
const APP_SCHEME = "app";
const APP_HOST = "pediatrix";

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function serveRenderer(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.normalize(path.join(RENDERER_DIST, decodeURIComponent(pathname)));
    // Refuse toute sortie du dossier dist (ex. "../../").
    if (!filePath.startsWith(RENDERER_DIST)) {
      return new Response("Interdit", { status: 403 });
    }
    const target = pathname === "/" ? path.join(RENDERER_DIST, "index.html") : filePath;
    return net.fetch(pathToFileURL(target).toString());
  });
}

function createWindow(): BrowserWindow {
  // Pas de barre de menus (File, Edit, View…) sur le poste clinique.
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    title: "Pédiatrix",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Pas de navigation vers l'extérieur : les liens externes s'ouvrent dans le
  // navigateur du système, jamais dans la fenêtre de l'application.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const allowed = DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.startsWith(`${APP_SCHEME}://${APP_HOST}/`);
    if (!allowed) event.preventDefault();
  });

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
  }
  return win;
}

// Une seule instance par poste.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    serveRenderer();
    const win = createWindow();
    initUpdater(win);
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
