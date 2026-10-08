# Publier une mise à jour des postes

Les postes se mettent à jour **via le LAN, sans Internet** : `electron-updater`
(source `generic`) interroge le backend Pédiatrix, qui sert le dossier `UPDATES_DIR`
sur `GET /updates/:file`. Même outil que Klyra, mais sans GitHub Releases.

## 1. Construire la nouvelle version

```bash
cd apps/desktop
npm version patch --no-git-tag-version   # 0.1.0 → 0.1.1 (la version doit augmenter)
npm run dist                             # Linux
npm run dist:win                         # Windows (sur une machine Windows)
```

`release/` contient alors les installeurs, les `.blockmap` et les fichiers de version
`latest-linux.yml` (Linux) / `latest.yml` (Windows).

## 2. Déposer les fichiers sur le backend

```bash
cp release/*.yml release/*.AppImage release/*.deb release/*.exe release/*.blockmap \
   ../backend/updates/ 2>/dev/null
```

Sous Windows (PowerShell, depuis `apps\desktop`) :
```powershell
New-Item -ItemType Directory -Force ..\backend\updates | Out-Null
Copy-Item release\latest.yml, release\*.exe, release\*.blockmap ..\backend\updates\
curl.exe http://localhost:3001/updates/latest.yml
```

(`UPDATES_DIR` dans `apps/backend/.env`, par défaut `./updates`.)

Vérifier :
```bash
curl http://localhost:3001/updates/latest-linux.yml
```

### Windows : erreur `EPERM … rename win-unpacked.tmp`

Constaté sur le poste de développement : `npm run dist:win` échoue avec
`EPERM: operation not permitted, rename '...\release\win-unpacked.tmp'` quand la
sortie est dans le projet (dossier `release\`), même après suppression de ce dossier.
La cause exacte n'a pas été établie (fichier retenu par l'éditeur ou l'antivirus
pendant le renommage). **Contournement vérifié** : produire la sortie hors du projet.

```powershell
npm run electron:build
npx electron-builder --win --config.directories.output=C:\pediatrix-release
```
L'installeur est alors `C:\pediatrix-release\Pediatrix-windows-x64.exe` ; copier les
fichiers de mise à jour depuis ce dossier (et non depuis `release\`).

## Tester une mise à jour de bout en bout (Windows)

1. Construire et installer la version courante (ex. 0.1.0) : `npm run dist:win`, puis
   lancer `release\Pediatrix-windows-x64.exe` et installer.
2. Monter la version (`npm version patch --no-git-tag-version` → 0.1.1), reconstruire
   (`npm run dist:win`) et copier les fichiers dans `..\backend\updates\` (ci-dessus).
3. Relancer l'application installée (0.1.0), backend démarré : après ~15 s, le bandeau
   « Mise à jour … » doit apparaître, puis « Redémarrer maintenant ».
4. Après redémarrage, vérifier la nouvelle version (Panneau de configuration →
   Programmes, ou propriétés de l'exécutable).

## 3. Côté postes

Au démarrage (après 15 s) puis toutes les 6 h, chaque poste vérifie la version,
télécharge la mise à jour, puis affiche un bandeau « Redémarrer maintenant ». Sans clic,
elle s'installe à la fermeture de l'application.

L'URL interrogée est `VITE_BACKEND_URL` + `/updates` (fixée au build), ou la variable
d'environnement `PEDIATRIX_UPDATE_URL` du poste si elle est définie.

## Limites connues

- **Formats mis à jour automatiquement** : AppImage (Linux) et NSIS (Windows).
  Le support du `.deb` par electron-updater n'a pas été vérifié dans ce projet :
  pour un poste installé en `.deb`, prévoir une réinstallation manuelle.
- **Pas de signature de code** : les installeurs ne sont pas signés (pas de certificat).
  Windows SmartScreen peut afficher un avertissement à l'installation.
- La route `/updates` n'exige pas de JWT (le poste vérifie avant toute connexion) ;
  elle ne sert que des fichiers d'installation, jamais de données patient.
