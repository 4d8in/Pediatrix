#!/usr/bin/env bash
# Restaure une sauvegarde produite par le service « backup » du déploiement complet
# (docker compose --profile full) : fichiers clinique-….dump[.enc] et backend-….tar.gz[.enc].
#
#   ./scripts/restore-full.sh --test clinique-….dump.enc
#       Test NON destructif : restaure dans une base temporaire, compte les tables, la supprime.
#       À faire régulièrement pour vérifier que les sauvegardes sont lisibles.
#
#   ./scripts/restore-full.sh clinique-….dump.enc backend-….tar.gz.enc
#       Restauration RÉELLE : remplace toutes les données actuelles (confirmation « OUI »).
#
# Fichiers chiffrés (.enc) : la phrase secrète est lue dans BACKUP_PASSPHRASE
# (variable d'environnement) ou demandée à la saisie.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TEST=0
if [ "${1:-}" = "--test" ]; then TEST=1; shift; fi
DUMP="${1:-}"
BACKEND_ARCHIVE="${2:-}"

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage : $0 [--test] clinique-….dump[.enc] [backend-….tar.gz[.enc]]" >&2
  exit 1
fi
if [ "$TEST" -eq 0 ] && [ -z "$BACKEND_ARCHIVE" ]; then
  echo "Restauration réelle : indiquez aussi l'archive backend-….tar.gz[.enc] (comptes, tarifs)." >&2
  exit 1
fi

for bin in docker openssl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ÉCHEC : '$bin' est requis." >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

decrypt() { # $1 = fichier source, $2 = sortie
  case "$1" in
    *.enc)
      if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
        read -r -s -p "Phrase secrète de chiffrement : " BACKUP_PASSPHRASE; echo
        export BACKUP_PASSPHRASE
      fi
      openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$1" -out "$2" \
        || { echo "ÉCHEC : déchiffrement impossible (phrase secrète incorrecte ?)." >&2; exit 1; }
      ;;
    *) cp "$1" "$2" ;;
  esac
}

decrypt "$DUMP" "$WORK/clinique.dump"
echo "Sauvegarde déchiffrée ($(du -h "$WORK/clinique.dump" | cut -f1))."

pg() { docker compose exec -T postgres sh -c "$1"; }

if [ "$TEST" -eq 1 ]; then
  SCRATCH="restore_test_$$"
  echo "Test : restauration dans la base temporaire ${SCRATCH} (les données réelles ne sont pas touchées)..."
  pg "createdb -U \"\$POSTGRES_USER\" ${SCRATCH}"
  cleanup_scratch() { pg "dropdb -U \"\$POSTGRES_USER\" --if-exists ${SCRATCH}" >/dev/null 2>&1 || true; }
  trap 'cleanup_scratch; rm -rf "$WORK"' EXIT
  docker compose exec -T postgres sh -c "pg_restore -U \"\$POSTGRES_USER\" -d ${SCRATCH} --no-owner" < "$WORK/clinique.dump" || true
  TABLES="$(pg "psql -U \"\$POSTGRES_USER\" -d ${SCRATCH} -tAc \"select count(*) from information_schema.tables where table_schema='public'\"" | tr -d '[:space:]')"
  RESOURCES="$(pg "psql -U \"\$POSTGRES_USER\" -d ${SCRATCH} -tAc \"select count(*) from hfj_resource\" 2>/dev/null || echo 0" | tr -d '[:space:]')"
  echo "Résultat : ${TABLES} tables restaurées, ${RESOURCES} ressources FHIR (hfj_resource)."
  [ "${TABLES:-0}" -gt 0 ] || { echo "ÉCHEC : la sauvegarde ne contient aucune table lisible." >&2; exit 1; }
  echo "OK : la sauvegarde est lisible. Base temporaire supprimée."
  exit 0
fi

[ -f "$BACKEND_ARCHIVE" ] || { echo "Fichier introuvable : $BACKEND_ARCHIVE" >&2; exit 1; }
decrypt "$BACKEND_ARCHIVE" "$WORK/backend.tar.gz"

read -r -p "Remplacer TOUTES les données actuelles (dossiers, comptes, tarifs) ? Tapez OUI : " answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 1; }

echo "Arrêt du backend et de HAPI..."
docker compose --profile full stop backend hapi-fhir 2>/dev/null || docker compose stop hapi-fhir

echo "Restauration de la base clinique..."
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$WORK/clinique.dump"

echo "Restauration des données du backend (comptes, tarifs, correspondance DHIS2)..."
docker run --rm -v pediatrix_backend_data:/data -v "$WORK":/in docker.io/library/alpine:3 \
  sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /in/backend.tar.gz -C /data && chown -R 1000:1000 /data'

echo "Redémarrage..."
docker compose --profile full start hapi-fhir backend 2>/dev/null || docker compose start hapi-fhir
echo "OK : restauration terminée. Attendre que HAPI soit « healthy » (docker compose ps)."
