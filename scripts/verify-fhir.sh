#!/usr/bin/env bash
# Vérifie bout-en-bout que la chaîne HAPI FHIR + PostgreSQL fonctionne :
#   1. HAPI répond sur /fhir/metadata
#   2. POST d'un Patient fictif, GET de relecture
#   3. Persistance réelle vérifiée directement dans PostgreSQL

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FHIR_BASE_URL="http://localhost:8080/fhir"
MAX_ATTEMPTS=60

# --- Dépendances ---------------------------------------------------------

for bin in curl jq docker; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

if [ ! -f .env ]; then
  echo "ÉCHEC : fichier .env introuvable à la racine du projet." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

# --- 1. Attente de HAPI FHIR ----------------------------------------------

echo "Attente de la disponibilité de HAPI FHIR sur ${FHIR_BASE_URL}/metadata ..."
attempt=0
until curl -sf -o /dev/null "${FHIR_BASE_URL}/metadata"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "ÉCHEC : HAPI FHIR ne répond toujours pas après ${MAX_ATTEMPTS} tentatives." >&2
    exit 1
  fi
  sleep 2
done
echo "OK : HAPI FHIR répond sur /fhir/metadata."

# --- 2. POST d'un Patient fictif -------------------------------------------

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "resourceType": "Patient",
  "identifier": [
    {
      "system": "urn:pediatrix:test-patient",
      "value": "TEST-VERIFY-FHIR-001"
    }
  ],
  "name": [
    {
      "family": "Ndiaye",
      "given": ["Astou"]
    }
  ],
  "gender": "female",
  "birthDate": "2021-03-14"
}
JSON
)

echo "Envoi d'un Patient fictif (Astou Ndiaye) ..."
POST_RESPONSE=$(curl -sf -X POST "${FHIR_BASE_URL}/Patient" \
  -H "Content-Type: application/fhir+json" \
  -d "$PATIENT_PAYLOAD")

PATIENT_ID=$(echo "$POST_RESPONSE" | jq -r '.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "ÉCHEC : aucune id retournée par le POST /Patient." >&2
  echo "Réponse du serveur : $POST_RESPONSE" >&2
  exit 1
fi
echo "OK : Patient créé avec l'id ${PATIENT_ID}."

# --- 3. GET de relecture ----------------------------------------------------

echo "Relecture du Patient/${PATIENT_ID} ..."
GET_RESPONSE=$(curl -sf "${FHIR_BASE_URL}/Patient/${PATIENT_ID}")

GET_FAMILY=$(echo "$GET_RESPONSE" | jq -r '.name[0].family // empty')

if [ "$GET_FAMILY" != "Ndiaye" ]; then
  echo "ÉCHEC : le Patient relu ne correspond pas à celui créé." >&2
  echo "Réponse du serveur : $GET_RESPONSE" >&2
  exit 1
fi
echo "OK : GET /Patient/${PATIENT_ID} renvoie bien le patient créé (nom de famille : ${GET_FAMILY})."

# --- 4. Vérification de la persistance dans PostgreSQL ---------------------

echo "Vérification de la persistance dans PostgreSQL ..."
SQL_QUERY="SELECT r.res_type, r.fhir_id, v.res_text_vc
FROM hfj_resource r
JOIN hfj_res_ver v ON v.res_id = r.res_id
WHERE r.res_type = 'Patient' AND r.fhir_id = '${PATIENT_ID}';"

DB_ROW=$(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "$SQL_QUERY")

if [ -z "$DB_ROW" ]; then
  echo "ÉCHEC : aucune ligne trouvée dans hfj_resource/hfj_res_ver pour Patient/${PATIENT_ID}." >&2
  exit 1
fi

if ! echo "$DB_ROW" | grep -q "Ndiaye"; then
  echo "ÉCHEC : la ligne PostgreSQL trouvée ne contient pas le nom attendu (Ndiaye)." >&2
  echo "Contenu : $DB_ROW" >&2
  exit 1
fi

echo "OK : le Patient est bien persisté dans PostgreSQL (table hfj_resource / hfj_res_ver)."
echo ""
echo "SUCCÈS : la chaîne HAPI FHIR + PostgreSQL fonctionne de bout en bout."
