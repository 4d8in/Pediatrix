# Pédiatrix — poste desktop

Interface React + TypeScript + Tailwind, empaquetée avec Electron.

| Dossier | Rôle |
|---|---|
| `src/` | interface React (aucune logique métier : tout passe par le backend) |
| `electron/main.ts` | processus principal : fenêtre, protocole `app://pediatrix` |
| `electron/preload.ts` | pont minimal vers l'UI (API de mise à jour uniquement) |
| `electron/updater.ts` | mises à jour via le backend sur le LAN |
| `electron-builder.json5` | packaging Linux (AppImage, .deb) et Windows (NSIS) |

## Commandes

```bash
npm run dev            # UI web seule (http://localhost:1420), utilisée par Playwright
npm run electron:dev   # application Electron en développement
npm run dist           # paquets Linux dans release/
npm run dist:win       # installeur Windows (sur une machine Windows)
npm run test:e2e       # tests Playwright
```

Publication d'une mise à jour : voir [RELEASING.md](RELEASING.md).
