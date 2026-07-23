#!/usr/bin/env bash
# Vérifie la chaîne du service d'agrégation (reporting) :
#   1. Déclenche un cycle d'agrégation unique (lit HAPI, écrit sur Supabase)
#   2. Relit les tables de reporting sur Supabase et affiche les compteurs
#   3. Contrôle explicite : aucune colonne des tables reporting ne doit
#      ressembler à un champ nominatif (nom, date de naissance, id patient...)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Dépendances ---------------------------------------------------------

for bin in psql npm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f apps/backend/.env ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' apps/backend/.env | tail -n1 | cut -d'=' -f2-)"
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ÉCHEC : SUPABASE_DB_URL introuvable (ni en variable d'env, ni dans apps/backend/.env)." >&2
  exit 1
fi

# --- 1. Déclenche un cycle d'agrégation unique ------------------------------

echo "Déclenchement d'un cycle d'agrégation unique (npm run reporting:once) ..."
(cd apps/backend && npm run --silent reporting:once)
echo "OK : cycle d'agrégation terminé."

# --- 2. Relit les tables de reporting sur Supabase --------------------------

echo ""
echo "Contenu de reporting_totaux :"
psql "$SUPABASE_DB_URL" -c "SELECT * FROM reporting_totaux;"

echo "Contenu de reporting_examens_par_type :"
psql "$SUPABASE_DB_URL" -c "SELECT * FROM reporting_examens_par_type ORDER BY nb DESC;"

echo "Contenu de reporting_consultations_par_jour :"
psql "$SUPABASE_DB_URL" -c "SELECT * FROM reporting_consultations_par_jour ORDER BY jour DESC;"

# --- 3. Contrôle : aucune colonne nominative dans les tables reporting ------

echo "Vérification qu'aucune colonne nominative n'existe dans les tables reporting ..."
FORBIDDEN_COLUMNS=$(psql "$SUPABASE_DB_URL" -t -A -c "
  SELECT table_name || '.' || column_name
  FROM information_schema.columns
  WHERE table_name LIKE 'reporting_%'
    AND column_name ~* '(name|nom|prenom|prénom|birth|naissance|patient_id|adresse|address|telephone|téléphone|phone)'
")

if [ -n "$FORBIDDEN_COLUMNS" ]; then
  echo "ÉCHEC : colonne(s) potentiellement nominative(s) détectée(s) dans les tables reporting :" >&2
  echo "$FORBIDDEN_COLUMNS" >&2
  exit 1
fi
echo "OK : aucune colonne nominative détectée dans les tables reporting."

echo ""
echo "SUCCÈS : le service d'agrégation écrit des agrégats anonymes sur Supabase."
