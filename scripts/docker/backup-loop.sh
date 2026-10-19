#!/bin/sh
# Sauvegarde automatique, lancée par le service « backup » de docker-compose.yml :
#  - base clinique PostgreSQL (dossiers HAPI) : pg_dump au format compressé ;
#  - données du backend (comptes, tarifs, correspondance DHIS2) : archive tar.gz ;
#  - chiffrement AES-256 si BACKUP_PASSPHRASE est défini ;
#  - conservation des BACKUP_KEEP dernières sauvegardes de chaque type.
# Restauration : scripts/restore-db.sh (déchiffrer d'abord un fichier .enc, voir docs/ADMINISTRATION.md).
set -eu

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
KEEP="${BACKUP_KEEP:-14}"
DEST=/backups
umask 077
chmod 700 "$DEST" 2>/dev/null || true

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "ATTENTION : BACKUP_PASSPHRASE est vide, les sauvegardes seront EN CLAIR." >&2
fi

# Chiffrement demandé mais impossible : on s'arrête plutôt que de laisser une sauvegarde en clair.
if [ -n "${BACKUP_PASSPHRASE:-}" ] && ! command -v openssl >/dev/null 2>&1; then
  echo "ÉCHEC : BACKUP_PASSPHRASE est défini mais openssl est introuvable (image de sauvegarde incorrecte)." >&2
  exit 1
fi

encrypt_if_needed() {
  file="$1"
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    if ! openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -in "$file" -out "$file.enc"; then
      rm -f "$file" "$file.enc"
      echo "ÉCHEC : chiffrement de $file impossible ; la sauvegarde en clair a été supprimée." >&2
      exit 1
    fi
    rm -f "$file"
  fi
}

prune() {
  # $1 = préfixe ; supprime les plus anciennes au-delà de KEEP
  ls -1t "$DEST"/"$1"-* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f "$old"; done
}

while true; do
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  echo "[$(date -u +%FT%TZ)] Sauvegarde ${stamp}"

  pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$DEST/clinique-$stamp.dump"
  encrypt_if_needed "$DEST/clinique-$stamp.dump"
  prune clinique

  if [ -d /backend-data ]; then
    tar -czf "$DEST/backend-$stamp.tar.gz" -C /backend-data .
    encrypt_if_needed "$DEST/backend-$stamp.tar.gz"
    prune backend
  fi

  echo "[$(date -u +%FT%TZ)] Terminé. Prochaine sauvegarde dans ${INTERVAL_HOURS} h."
  sleep "$((INTERVAL_HOURS * 3600))"
done
