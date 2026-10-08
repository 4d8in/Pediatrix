#!/usr/bin/env bash
# Sauvegarde complète de Pédiatrix dans backups/<date>/ :
#   - base PostgreSQL « clinique » (toutes les ressources FHIR de HAPI), format pg_dump custom ;
#   - apps/backend/data/ (comptes et hash des mots de passe, résultats lus).
# PostgreSQL n'étant pas exposé sur l'hôte, le dump passe par `docker compose exec`.
# Les sauvegardes contiennent des données de santé : ne jamais les versionner ni les
# copier hors de l'hôpital.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="backups/${STAMP}"
mkdir -p "$DEST"

echo "Sauvegarde de la base clinique..."
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${DEST}/clinique.dump"

if [ -d apps/backend/data ]; then
  echo "Sauvegarde de apps/backend/data..."
  cp -r apps/backend/data "${DEST}/backend-data"
fi

echo "OK : sauvegarde dans ${DEST} ($(du -sh "$DEST" | cut -f1))."
