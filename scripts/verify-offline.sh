#!/usr/bin/env bash
# Preuve offline-first : le flux clinique fonctionne sans aucun accès Internet.
#   1. Vérifie que la machine n'a PAS accès à Internet (un ping externe échoue)
#      — si l'accès Internet est disponible, le script s'arrête : ce n'est pas
#      une preuve tant que la coupure n'est pas confirmée.
#   2. Rejoue le flux clinique complet (scripts/verify-lab-flow.sh) et confirme
#      qu'il réussit sans Internet.
#   3. Confirme que le service d'agrégation (reporting), qui dépend d'un
#      PostgreSQL Supabase distant, échoue proprement hors ligne.
#   4. Confirme que cet échec n'affecte pas le backend clinique (toujours 100%
#      local), en revérifiant /api/health après coup.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_URL="http://localhost:3001"
EXTERNAL_HOST="1.1.1.1"

# --- Dépendances ---------------------------------------------------------

for bin in curl ping npm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

# --- 1. Confirmer l'absence d'accès Internet --------------------------------

echo "Vérification de la coupure Internet (ping -c 1 -W 2 ${EXTERNAL_HOST}) ..."
if ping -c 1 -W 2 "$EXTERNAL_HOST" >/dev/null 2>&1; then
  echo "ÉCHEC : ${EXTERNAL_HOST} répond au ping — la machine a encore accès à Internet." >&2
  echo "Couper la connexion réseau externe avant de relancer ce script (le LAN local vers le backend/HAPI/PostgreSQL doit lui rester actif)." >&2
  exit 1
fi
echo "OK : ${EXTERNAL_HOST} ne répond pas — pas d'accès Internet confirmé."
echo ""

# --- 2. Rejouer le flux clinique complet, sans Internet ---------------------

echo "Rejeu du flux clinique complet (scripts/verify-lab-flow.sh) sans Internet ..."
if ! ./scripts/verify-lab-flow.sh; then
  echo "ÉCHEC : le flux clinique ne fonctionne pas hors ligne." >&2
  exit 1
fi
echo ""
echo "OK : le flux clinique fonctionne bien sans accès Internet."
echo ""

# --- 3. Le service d'agrégation doit échouer proprement, lui, hors ligne ----

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f apps/backend/.env ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' apps/backend/.env | tail -n1 | cut -d'=' -f2-)"
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ÉCHEC : SUPABASE_DB_URL introuvable (ni en variable d'env, ni dans apps/backend/.env)." >&2
  echo "Nécessaire pour distinguer un échec dû à l'absence d'Internet d'un échec de configuration." >&2
  exit 1
fi

echo "Déclenchement d'un cycle d'agrégation (npm run reporting:once) — doit échouer hors ligne ..."
REPORTING_FAILED=0
(cd apps/backend && npm run --silent reporting:once) >/tmp/pediatrix-verify-offline-reporting.log 2>&1 || REPORTING_FAILED=1

if [ "$REPORTING_FAILED" -ne 1 ]; then
  echo "ÉCHEC : le cycle d'agrégation a réussi alors que la machine est censée être hors ligne (vérifier SUPABASE_DB_URL / la coupure réseau)." >&2
  exit 1
fi
echo "OK : le service d'agrégation échoue bien hors ligne (log : /tmp/pediatrix-verify-offline-reporting.log)."
echo ""

# --- 4. Le backend clinique n'est pas affecté par cet échec -----------------

echo "Vérification que le backend clinique répond toujours (GET /api/health) ..."
if ! curl -sf -o /dev/null "${BACKEND_URL}/api/health"; then
  echo "ÉCHEC : le backend ne répond plus après l'échec du reporting — l'indépendance des deux processus n'est pas respectée." >&2
  exit 1
fi
echo "OK : le backend clinique répond toujours, indépendamment de l'échec du reporting."
echo ""

echo "SUCCÈS : le flux clinique fonctionne intégralement sans Internet ; seul le service d'agrégation (dépendant de Supabase) échoue, proprement et sans impact sur le clinique."
