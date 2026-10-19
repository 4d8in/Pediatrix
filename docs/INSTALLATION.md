# Installation et déploiement

Ce guide installe Pédiatrix dans un établissement : un **serveur** (au dépôt de l'hôpital, sur le réseau local) et des **postes** (accueil, consultation, laboratoire, pharmacie, caisse…).

Tout fonctionne **sans Internet** une fois l'installation faite. Internet n'est utile que pour télécharger les images et les paquets lors de la première installation, et pour le service de reporting vers un serveur distant (facultatif).

## 1. Le serveur

### Matériel et logiciels

- Un ordinateur (ou mini-serveur) allumé en continu, relié au réseau local. À dimensionner selon l'établissement : l'ordre de grandeur n'a pas été mesuré dans ce projet (voir « Limites »).
- Linux ou Windows avec **Docker** et **Docker Compose v2** (`docker compose version`).
- Node.js 24 uniquement si vous lancez le backend hors Docker (mode développement).

### Premier démarrage (tout dans Docker)

```bash
git clone <dépôt> pediatrix && cd pediatrix

# 1. Réglages de la base de données et des sauvegardes
cp .env.example .env
#   -> changer POSTGRES_PASSWORD ; définir BACKUP_PASSPHRASE (chiffrement des sauvegardes)

# 2. Réglages du backend
cp apps/backend/.env.example apps/backend/.env
#   -> JWT_SECRET : une longue chaîne aléatoire (ex. `openssl rand -hex 48`)
#   -> SEED_USER_PASSWORD : mot de passe des comptes de démonstration (à remplacer ensuite)
#   -> FACILITY_NAME / FACILITY_ADDRESS / FACILITY_PHONE : en-tête des documents imprimés

# 3. Construire et démarrer : HAPI FHIR, PostgreSQL, backend, sauvegarde automatique
docker compose --profile full up -d --build
```

Vérifier :

```bash
curl http://localhost:3001/api/health        # {"status":"ok", ...}
docker compose --profile full ps             # tous les services « healthy » ou « running »
```

Le démarrage de HAPI prend 1 à 2 minutes la première fois.

### Créer les comptes et les lits

Depuis un poste de développement ou le dossier `apps/backend` (Node requis) :

```bash
cd apps/backend && npm ci
npx tsx src/scripts/seed-users.ts   # un compte de démonstration par rôle
npx tsx src/scripts/seed-beds.ts    # 4 services et 20 lits (modifiable dans le script)
```

Ces comptes servent à la prise en main. **Avant la mise en service réelle**, l'administrateur technique crée les vrais comptes (écran « Comptes ») et désactive ceux de démonstration.

### Ce que démarre chaque profil

| Commande | Services |
| --- | --- |
| `docker compose up -d` | HAPI FHIR + PostgreSQL (backend lancé à la main, mode développement) |
| `docker compose --profile full up -d` | + backend + sauvegarde automatique |
| `docker compose --profile full --profile tls up -d` | + chiffrement TLS du réseau local |

Les données vivent dans des volumes Docker nommés (`pediatrix_postgres_data`, `pediatrix_backend_data`). Ne jamais lancer `docker compose down -v` : cela les supprime.

### Chiffrer le réseau local (TLS)

Sans TLS, les mots de passe et les dossiers circulent en clair sur le réseau de l'hôpital. Le profil `tls` place un proxy Caddy devant le backend, avec un certificat d'une autorité interne (aucun service externe).

1. Choisir un nom pour le serveur (ex. `pediatrix.lan`) et le déclarer dans le DNS local, ou dans le fichier `hosts` de chaque poste. Renseigner `TLS_HOST` dans `.env`.
2. `docker compose --profile full --profile tls up -d`
3. Récupérer le certificat racine de l'autorité interne et l'installer sur chaque poste (une fois) :
   ```bash
   docker cp pediatrix-tls:/data/caddy/pki/authorities/local/root.crt ./pediatrix-root.crt
   ```
   Windows : double-clic sur le fichier, « Installer le certificat », magasin « Autorités de certification racines de confiance ». Linux : `sudo cp pediatrix-root.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`.
4. Construire les postes avec `VITE_BACKEND_URL=https://pediatrix.lan:3443` (voir section 2).

Vérifié lors de la conception : HTTPS/HTTP2 vers le backend avec la racine de l'autorité interne. Non vérifié : l'installation du certificat sur Windows.

L'accès direct à HAPI (port 8080) n'est publié que sur la machine serveur elle-même (`127.0.0.1`) : HAPI n'a pas d'authentification propre et contournerait les rôles.

## 2. Les postes

L'application de bureau (Electron) se construit une fois puis s'installe sur chaque poste.

```bash
cd apps/desktop
cp .env.example .env
#   -> VITE_BACKEND_URL=http://<adresse-ou-nom-du-serveur>:3001   (ou https://…:3443 avec TLS)
npm ci
npm run dist        # Linux : AppImage et .deb dans apps/desktop/release/
npm run dist:win    # Windows (à lancer sur une machine Windows) : installeur .exe
```

L'adresse du serveur est **figée à la construction** : changer d'adresse demande de reconstruire l'application.

Installer ensuite le fichier produit sur chaque poste. Les installeurs ne sont pas signés (un avertissement Windows SmartScreen peut apparaître).

### Mises à jour des postes

Les postes se mettent à jour depuis le serveur, sans Internet : voir `apps/desktop/RELEASING.md`.

## 3. Sauvegarde et restauration

Le service `backup` (profil `full`) sauvegarde **chaque jour** dans le dossier `backups/` :

- `clinique-AAAAMMJJ-HHMMSS.dump[.enc]` : tous les dossiers patients (base PostgreSQL de HAPI) ;
- `backend-AAAAMMJJ-HHMMSS.tar.gz[.enc]` : comptes, tarifs, correspondance DHIS2.

Les 14 dernières de chaque sorte sont conservées (`BACKUP_KEEP`). Avec `BACKUP_PASSPHRASE`, les fichiers sont chiffrés (AES-256) et portent l'extension `.enc`.

**À faire en plus** : copier régulièrement `backups/` hors du serveur (disque externe, autre site). Une sauvegarde sur la même machine ne protège pas d'un incendie, d'un vol ou d'une panne de disque. **Conserver la phrase secrète ailleurs** que sur le serveur.

### Tester la restauration

Une sauvegarde jamais lue n'est pas une sauvegarde. Ce test **ne touche pas aux données réelles** (il restaure dans une base temporaire, compte les tables et la supprime) ; à faire au moins une fois par mois :

```bash
BACKUP_PASSPHRASE='<phrase secrète>' ./scripts/restore-full.sh --test backups/clinique-….dump.enc
```

### Restaurer pour de bon

**Remplace toutes les données actuelles.** Arrête le backend et HAPI, restaure la base puis les comptes et tarifs, relance :

```bash
./scripts/restore-full.sh backups/clinique-….dump.enc backups/backend-….tar.gz.enc
```

Vérifié : le test de lecture (`--test`), le déchiffrement et le rejet d'une mauvaise phrase secrète. **Non vérifié sur ce projet** : la restauration réelle de bout en bout (elle est destructive) — la répéter sur une machine de test avant d'en avoir besoin.

## 4. Mise à jour du serveur

```bash
git pull
docker compose --profile full up -d --build
```

Les volumes (données) sont conservés. Pour avoir une sauvegarde toute fraîche avant la mise à jour, redémarrez le service de sauvegarde : il en effectue une immédiatement (`docker compose --profile full restart backup`).

## 5. Limites connues de ce déploiement

- **Pas de haute disponibilité** : une seule machine ; en cas de panne, il faut restaurer (voir ci-dessus) ou remplacer le matériel.
- **Pas de mode hors ligne sur les postes** : si le serveur est injoignable, un bandeau l'indique et la saisie attend le retour du serveur.
- **Dimensionnement non mesuré** : aucun test de charge n'a été fait. À valider lors d'un pilote.
- **Pas d'onduleur géré par le logiciel** : prévoir un onduleur pour le serveur (coupures de courant).
- Signature de code des installeurs non faite.
