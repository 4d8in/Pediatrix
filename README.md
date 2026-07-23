# Pédiatrix

Plateforme de gestion hospitalière modulaire et extensible — prototype de mémoire de
licence (hôpital de district, cas d'étude Sénégal). Ce README couvre le déploiement
complet du prototype : infrastructure, backend, client desktop, packaging et preuve
offline-first. Voir [CLAUDE.md](CLAUDE.md) pour le contexte du projet et les choix
d'architecture.

## Architecture en bref

```
Postes Tauri (Accueil · Pédiatrie · Laboratoire)
        ↓ LAN (REST/FHIR)
Backend Node.js  ── SOCLE : identité patient · auth & rôles
                 └─ MODULES : Pédiatrie · Laboratoire · Radiologie (module-souche)
        ↓ produisent du FHIR
Serveur HAPI FHIR (Docker)
        ↓
PostgreSQL "clinique" ──[service d'agrégation]──> PostgreSQL "reporting" (Supabase)
```

- **Contrat inter-modules** : ressources FHIR (`Patient`, `Encounter`, `Observation`,
  `ServiceRequest`, `DiagnosticReport`). Un module ne dépend jamais du code d'un autre.
- **Deux rôles PostgreSQL** : `clinique` (persistance HAPI, LAN, jamais exposé sur
  l'hôte) et `reporting` (agrégats anonymes, hébergé sur Supabase — le seul point du
  système qui nécessite Internet).
- **Auth** : JWT, contrôle d'accès par rôle vérifié côté backend sur chaque route.

## Prérequis

### Infrastructure (Docker)
- Docker et Docker Compose v2 (`docker compose version`)
- `curl` et `jq` (scripts de vérification)
- `psql` (client PostgreSQL, pour `scripts/verify-reporting.sh`)

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
Docker téléchargées (LAN uniquement) — seul le service d'agrégation (reporting)
nécessite Internet, et son indisponibilité n'affecte jamais le fonctionnement clinique
(voir [Preuve offline-first](#preuve-offline-first)).

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

## 3. Créer les comptes de démonstration (auth)

Toutes les routes cliniques exigent un JWT. Créer les 5 comptes de test (un par rôle) :

```bash
./scripts/seed-users.sh
```

Réutilise `SEED_USER_PASSWORD` défini dans `apps/backend/.env`. Script idempotent
(ré-exécutable sans dupliquer les comptes).

Vérifier que le contrôle d'accès par rôle bloque bien ce qu'il doit bloquer :
```bash
./scripts/verify-auth.sh
```

## 4. Lancer le client desktop (mode développement)

Dans un autre terminal, une fois le backend démarré :
```bash
cd apps/desktop
npm install
npm run tauri dev
```

Par défaut, l'app suppose un backend sur `http://localhost:3001` (même machine).
Pour connecter ce poste à un backend situé sur une autre machine du LAN, voir
[VITE_BACKEND_URL](#url-du-backend-configurable) ci-dessous.

## 5. Vérifier les flux cliniques bout-en-bout

```bash
./scripts/verify-admission.sh      # Admission → Consultation
./scripts/verify-lab-flow.sh       # Pédiatrie → Laboratoire → retour médecin
./scripts/verify-imaging-flow.sh   # Pédiatrie → Radiologie → retour médecin
```

## 6. Service d'agrégation (reporting)

Lit périodiquement les ressources FHIR sur HAPI, calcule des statistiques agrégées
(totaux, répartition des examens, consultations par jour) et les écrit sur un
PostgreSQL "reporting" hébergé sur Supabase. Aucune donnée nominative n'y est envoyée —
voir `apps/backend/src/reporting/`.

Renseigner `SUPABASE_DB_URL` dans `apps/backend/.env` (chaîne `postgres://` fournie
par Supabase), puis :

```bash
cd apps/backend
npm run reporting:start   # boucle continue (intervalle : REPORTING_INTERVAL_MS)
# ou, pour un seul cycle :
npm run reporting:once
```

Ce service tourne indépendamment du backend clinique (Fastify) : une panne ou une
indisponibilité de Supabase n'affecte jamais le fonctionnement local (offline) du
backend, et le service d'agrégation retente simplement au cycle suivant.

Vérifier la chaîne complète :
```bash
./scripts/verify-reporting.sh
```

## 7. Packaging de l'app desktop (Linux)

### URL du backend configurable

`apps/desktop/src/lib/api.ts` lit `VITE_BACKEND_URL` au build (variable Vite, fallback
`http://localhost:3001`). Pour un poste dont le backend n'est pas sur la même machine :

```bash
cd apps/desktop
cp .env.example .env
# éditer .env : VITE_BACKEND_URL=http://<ip-du-poste-backend>:3001
```

Cette valeur est figée au moment du build : changer l'IP nécessite de recompiler,
pas de configuration au lancement.

### Build de production

```bash
cd apps/desktop
npm install
npm run tauri build
```

Sur cette machine (Pop!_OS 22.04, x86_64), la commande produit :
- `apps/desktop/src-tauri/target/release/bundle/deb/desktop_0.1.0_amd64.deb`
- `apps/desktop/src-tauri/target/release/bundle/appimage/desktop_0.1.0_amd64.AppImage`

`tauri.conf.json` restreint volontairement les cibles à `["deb", "appimage"]` : la
cible `.rpm` n'a pas été testée ici (`rpmbuild` non installé sur la machine de build).

Le build compile un binaire Rust en mode release (plusieurs minutes) et télécharge, la
première fois, les outils de bundling AppImage (`linuxdeploy`, `AppRun`,
`linuxdeploy-plugin-appimage`) depuis GitHub — **accès Internet nécessaire pendant le
build**, jamais au lancement de l'app (offline-first non affecté).

### Installer et lancer l'app packagée

```bash
# .deb
sudo dpkg -i apps/desktop/src-tauri/target/release/bundle/deb/desktop_0.1.0_amd64.deb
desktop   # lance l'app installée

# ou .AppImage, sans installation
chmod +x apps/desktop/src-tauri/target/release/bundle/appimage/desktop_0.1.0_amd64.AppImage
./apps/desktop/src-tauri/target/release/bundle/appimage/desktop_0.1.0_amd64.AppImage
```

Vérifier que l'app se connecte bien au backend local (le backend et l'infra Docker
doivent tourner, voir sections 1 et 2) : l'écran de connexion doit apparaître sans
erreur réseau.

### Build Windows (non fourni ici)

Non testé ni implémenté dans ce dépôt (pas de cross-compilation tentée). L'approche
recommandée par Tauri pour produire un `.msi`/`.exe` Windows est une CI GitHub Actions
avec [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action), qui
lance le build sur un runner `windows-latest`. Aucun workflow `.github/workflows/`
n'existe dans ce dépôt à ce jour — à créer si un build Windows est requis, en suivant
la documentation officielle : https://v2.tauri.app/distribute/pipelines/github/

## Preuve offline-first

```bash
./scripts/verify-offline.sh
```

Ce script vérifie d'abord que la machine n'a *pas* accès à Internet (échec d'un ping
externe), puis rejoue le flux clinique complet (`verify-lab-flow.sh`) et confirme qu'il
réussit sans Internet. Il vérifie aussi que le service d'agrégation échoue proprement
(Supabase injoignable) sans affecter le backend clinique.

## Limites connues

- **Cache de recherche HAPI** : `GET /api/lab/requests` peut, juste après l'écriture
  d'une nouvelle ressource, renvoyer un résultat momentanément périmé. Contourné côté
  vérification par quelques tentatives espacées (voir `scripts/verify-lab-flow.sh`) ;
  la durée exacte de ce délai côté configuration HAPI n'est pas confirmée.
- **Comptes de démonstration** : un compte par rôle, mot de passe partagé
  (`SEED_USER_PASSWORD`), créés par `scripts/seed-users.sh`. Adapté à une démonstration,
  pas à un déploiement réel.
- **Reporting dépend d'Internet** : le service d'agrégation écrit sur un PostgreSQL
  Supabase distant. Hors ligne, il échoue proprement (voir `apps/backend/src/reporting/db.ts`)
  sans jamais faire tomber le backend clinique, qui reste 100% local.
- **Build Windows non fourni** : uniquement documenté ci-dessus (GitHub Actions), pas
  implémenté ni testé dans ce dépôt.
- **Cible `.rpm` non produite** : `rpmbuild` absent de la machine de build utilisée
  pour ce prototype ; seuls `.deb` et `.AppImage` sont générés.
