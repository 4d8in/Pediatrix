# Pédiatrix

Plateforme de gestion hospitalière modulaire et extensible — prototype de mémoire de
licence (hôpital de district, cas d'étude Sénégal). Ce README couvre le déploiement
complet du prototype : infrastructure, backend, client desktop, packaging et preuve
offline-first. Voir [CLAUDE.md](CLAUDE.md) pour le contexte du projet et les choix
d'architecture.

## Architecture en bref

```
Postes Electron (Accueil · Pédiatrie · Laboratoire)
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

### Desktop (Electron)
- Node.js 24.x et npm (aucune dépendance système : Electron embarque son propre Chromium)

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

### Tests unitaires du backend

```bash
cd apps/backend
npm test
```
Vérifie les types puis lance les tests (`test/*.test.ts`, lanceur intégré à Node) :
contrôle des rôles, construction des ressources FHIR (patient, résultat labo), lits,
allergies, calcul des indicateurs d'hospitalisation. Ne nécessite ni HAPI ni Docker.

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

### Gestion des lits : créer les services et les lits

À faire une fois (script ré-exécutable, il ne modifie pas les lits existants) :
```bash
cd apps/backend
npx tsx src/scripts/seed-beds.ts
```
Crée 4 services (Pédiatrie générale 8 lits, Néonatologie 6, Urgences pédiatriques 4,
Isolement 2) sous forme de ressources FHIR `Location`. Les séjours sont des `Encounter`
de classe `IMP`, distincts des consultations (classe `AMB`).

### Sous Windows (PowerShell)

Les scripts `.sh` demandent Git Bash. Sans lui, lancer directement les scripts
TypeScript **depuis `apps\backend`** :
```powershell
cd apps\backend
npx tsx src/scripts/seed-users.ts
npx tsx src/scripts/seed-beds.ts
```

### Pages par rôle

| Rôle (compte de démo) | Accueil | Autres pages |
|---|---|---|
| Infirmière (`infirmiere1`) | Mes soins du jour | File active, Admission, Dossier, Lits, Vaccinations |
| Médecin (`medecin1`) | Tableau de bord + résultats non lus | File active, Admission, Consultations, Dossier, Lits, Vaccinations |
| Technicien labo (`labo1`) | Laboratoire (compteurs du jour) | Dossier patient |
| Radiologue (`radiologue1`) | Radiologie (compteurs du jour) | Dossier patient |
| Directeur (`directeur1`) | Tableau de bord | File active, Dossier, Lits (lecture), Statistiques |
| Admin technique (`admin1`) | Supervision | Comptes, Flux FHIR, Lits (état des lits) |

Tous les rôles ont aussi « Paramètres » (mot de passe, aide).

## 4. Lancer le client desktop (mode développement)

Dans un autre terminal, une fois le backend démarré :
```bash
cd apps/desktop
npm install
npm run electron:dev
```

`npm run dev` lance uniquement l'UI web (http://localhost:1420), utilisée par les tests Playwright.

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
npm run dist        # Linux : AppImage + .deb
npm run dist:win    # Windows : installeur NSIS (à lancer sur une machine Windows)
```

Produit dans `apps/desktop/release/` :
- `Pediatrix-linux-x86_64.AppImage` et `Pediatrix-linux-amd64.deb`
- `latest-linux.yml` (Linux) / `latest.yml` (Windows) : fichiers de version lus par le
  module de mise à jour.

Le premier build télécharge Electron et les outils de packaging depuis GitHub —
**accès Internet nécessaire pendant le build**, jamais au lancement de l'app.

### Installer et lancer l'app packagée

```bash
chmod +x apps/desktop/release/Pediatrix-linux-x86_64.AppImage
./apps/desktop/release/Pediatrix-linux-x86_64.AppImage
# ou : sudo dpkg -i apps/desktop/release/Pediatrix-linux-amd64.deb
```

### Mises à jour des postes (LAN, sans Internet)

Voir [apps/desktop/RELEASING.md](apps/desktop/RELEASING.md). En résumé : le backend sert
le dossier `UPDATES_DIR` sur `GET /updates/:file` ; chaque poste vérifie au démarrage
puis toutes les 6 h, télécharge la nouvelle version et propose de redémarrer.

## Preuve offline-first

```bash
./scripts/verify-offline.sh
```

Ce script vérifie d'abord que la machine n'a *pas* accès à Internet (échec d'un ping
externe), puis rejoue le flux clinique complet (`verify-lab-flow.sh`) et confirme qu'il
réussit sans Internet. Il vérifie aussi que le service d'agrégation échoue proprement
(Supabase injoignable) sans affecter le backend clinique.

## Sauvegarde et restauration

Sauvegarde la base clinique (toutes les ressources FHIR) **et** `apps/backend/data/`
(comptes, hash des mots de passe) dans `backups/<date>/` (dossier non versionné) :

```powershell
# Windows, depuis la racine du projet (Docker démarré)
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
powershell -ExecutionPolicy Bypass -File scripts\restore-db.ps1 backups\<date>
```
```bash
# Linux
./scripts/backup-db.sh
./scripts/restore-db.sh backups/<date>
```
La restauration **remplace toutes les données actuelles** (confirmation « OUI »
demandée) ; HAPI est arrêté pendant l'opération puis relancé. Les sauvegardes
contiennent des données de santé : les garder sur un support de l'hôpital.

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
- **Désactivation d'un compte** : une session déjà ouverte reste valide jusqu'à
  l'expiration du jeton ; seules les nouvelles connexions sont refusées.
- **Heure d'arrivée (File active)** : le socle n'a pas d'heure d'admission explicite ;
  on utilise la date de création de la fiche `Patient` (jamais modifiée par l'application).
- **Résultats « lus »** : état d'interface par médecin stocké dans
  `apps/backend/data/report-reads.json` (non versionné), pas dans HAPI.
- **Build Windows** : `npm run dist:win` (sur une machine Windows) produit l'installeur
  NSIS `release/Pediatrix-windows-x64.exe` ; procédure et test de mise à jour LAN dans
  `apps/desktop/RELEASING.md` (voir le contournement de l'erreur `EPERM` sous Windows).
  Installeur non signé (avertissement SmartScreen possible).
- **Cible `.rpm` non produite** : `rpmbuild` absent de la machine de build utilisée
  pour ce prototype ; seuls `.deb` et `.AppImage` sont générés.
