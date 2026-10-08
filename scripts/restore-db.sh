#!/usr/bin/env bash
# Restaure une sauvegarde créée par backup-db.sh : ./scripts/restore-db.sh backups/<date>
# ATTENTION : remplace toutes les données actuelles (base clinique et comptes).
# HAPI est arrêté pendant la restauration puis relancé.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -f "${SRC}/clinique.dump" ]; then
  echo "Usage : $0 backups/<date>  (le dossier doit contenir clinique.dump)" >&2
  exit 1
fi

read -r -p "Remplacer TOUTES les données actuelles par ${SRC} ? Tapez OUI : " answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 1; }

echo "Arrêt de HAPI..."
docker compose stop hapi-fhir

echo "Restauration de la base clinique..."
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "${SRC}/clinique.dump"

if [ -d "${SRC}/backend-data" ]; then
  echo "Restauration de apps/backend/data..."
  rm -rf apps/backend/data
  cp -r "${SRC}/backend-data" apps/backend/data
fi

echo "Redémarrage de HAPI..."
docker compose start hapi-fhir
echo "OK : restauration terminée. Attendre que HAPI soit « healthy » (docker compose ps)."
