# Pédiatrix

Étape 2 : squelettes backend (Node.js/Fastify) et desktop (Tauri v2/React), reliés
à l'infrastructure de l'étape 1. Aucune fonctionnalité métier à ce stade.

## Prérequis

### Infrastructure (Docker)
- Docker et Docker Compose v2 (`docker compose version`)
- `curl` et `jq` (pour le script de vérification)

### Backend
- Node.js 24.x et npm

### Desktop (Tauri v2)
- Node.js 24.x et npm
- Rust stable (via [rustup](https://rustup.rs), pas besoin de sudo)
- Dépendances système Linux (Debian/Ubuntu/Pop!_OS) :
  ```bash
  sudo apt update && sudo apt install -y \
    libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
    libssl-dev libxdo-dev patchelf build-essential
  ```
  Voir [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/) pour les autres OS.

Fonctionne entièrement hors ligne une fois les dépendances installées et les images
téléchargées (LAN uniquement).

## 1. Démarrer l'infrastructure (HAPI FHIR + PostgreSQL)

```bash
cp .env.example .env   # si .env n'existe pas encore
docker compose up -d
```

Vérifier que la chaîne fonctionne :
```bash
./scripts/verify-fhir.sh
```

Arrêter :
```bash
docker compose down       # garde les données
docker compose down -v    # supprime aussi le volume PostgreSQL
```

## 2. Lancer le backend

```bash
cd apps/backend
cp .env.example .env   # si .env n'existe pas encore
npm install
npm run dev
```

Le backend écoute par défaut sur `http://localhost:3001`. Vérifier :
```bash
curl http://localhost:3001/api/health
```

## 3. Lancer le client desktop

Dans un autre terminal, une fois le backend démarré :
```bash
cd apps/desktop
npm install
npm run tauri dev
```

Une fenêtre s'ouvre avec l'état du backend et de HAPI FHIR (connecté ou dégradé),
et un bouton pour relancer la vérification.
