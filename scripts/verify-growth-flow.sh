#!/usr/bin/env bash
# Vérifie bout-en-bout le module Croissance (Observation poids/taille/périmètre
# crânien), en passant par le backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif
#   3. POST d'une mesure de croissance (poids + taille) pour ce patient
#   4. Relecture de l'historique de croissance : la mesure doit être conforme
#   5. Un rôle non autorisé (technicien labo) est bloqué (403) à l'écriture

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_URL="http://localhost:3001"
MAX_ATTEMPTS=30

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

echo "Attente de la disponibilité du backend sur ${BACKEND_URL}/api/health ..."
attempt=0
until curl -sf -o /dev/null "${BACKEND_URL}/api/health"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "ÉCHEC : le backend ne répond toujours pas après ${MAX_ATTEMPTS} tentatives." >&2
    exit 1
  fi
  sleep 2
done
echo "OK : le backend répond sur /api/health."

if [ -z "${SEED_USER_PASSWORD:-}" ] && [ -f apps/backend/.env ]; then
  SEED_USER_PASSWORD="$(grep -E '^SEED_USER_PASSWORD=' apps/backend/.env | tail -n1 | cut -d'=' -f2-)"
fi
if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  echo "ÉCHEC : SEED_USER_PASSWORD introuvable (ni en variable d'env, ni dans apps/backend/.env)." >&2
  exit 1
fi

echo "Connexion en tant que médecin1 et labo1 (POST /api/auth/login) ..."
DOCTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
LAB_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"labo1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')

if [ -z "$DOCTOR_TOKEN" ] || [ -z "$LAB_TOKEN" ]; then
  echo "ÉCHEC : login medecin1/labo1 sans token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi
echo "OK : connecté en tant que médecin1 et labo1."

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Modou",
  "lastName": "Verify-Growth-Flow",
  "birthDate": "2023-06-01",
  "gender": "male",
  "guardian": {
    "name": "Bineta Sow",
    "relationship": "Mère",
    "phone": "+221705554433"
  }
}
JSON
)

echo "Création d'un Patient fictif (Modou Verify-Growth-Flow) via POST /api/patients ..."
POST_PATIENT_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PATIENT_PAYLOAD")

PATIENT_ID=$(echo "$POST_PATIENT_RESPONSE" | jq -r '.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "ÉCHEC : aucune id retournée par POST /api/patients." >&2
  echo "Réponse du serveur : $POST_PATIENT_RESPONSE" >&2
  exit 1
fi
echo "OK : Patient créé avec l'id ${PATIENT_ID}."

GROWTH_PAYLOAD=$(cat <<'JSON'
{
  "date": "2024-05-15",
  "weight": 9.4,
  "height": 72.5,
  "headCircumference": 44.1
}
JSON
)

echo "Enregistrement d'une mesure de croissance via POST /api/patients/${PATIENT_ID}/growth ..."
POST_GROWTH_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/growth" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$GROWTH_PAYLOAD")

OBSERVATION_COUNT=$(echo "$POST_GROWTH_RESPONSE" | jq -r '.observationIds | length // 0')

if [ "$OBSERVATION_COUNT" != "3" ]; then
  echo "ÉCHEC : attendu 3 Observation créées (poids, taille, périmètre crânien), reçu ${OBSERVATION_COUNT}." >&2
  echo "Réponse du serveur : $POST_GROWTH_RESPONSE" >&2
  exit 1
fi
echo "OK : 3 Observation créées pour la mesure du 2024-05-15."

echo "Relecture de l'historique de croissance (GET /api/patients/${PATIENT_ID}/growth) ..."
GET_GROWTH_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/growth" -H "Authorization: Bearer ${DOCTOR_TOKEN}")

RECORD_WEIGHT=$(echo "$GET_GROWTH_RESPONSE" | jq -r --arg date "2024-05-15" '.measurements[] | select(.date | startswith($date)) | .weight')
RECORD_HEIGHT=$(echo "$GET_GROWTH_RESPONSE" | jq -r --arg date "2024-05-15" '.measurements[] | select(.date | startswith($date)) | .height')
RECORD_HEAD=$(echo "$GET_GROWTH_RESPONSE" | jq -r --arg date "2024-05-15" '.measurements[] | select(.date | startswith($date)) | .headCircumference')

if [ "$RECORD_WEIGHT" != "9.4" ]; then
  echo "ÉCHEC : le poids relu (${RECORD_WEIGHT}) ne correspond pas à celui envoyé (9.4)." >&2
  echo "Réponse du serveur : $GET_GROWTH_RESPONSE" >&2
  exit 1
fi
if [ "$RECORD_HEIGHT" != "72.5" ]; then
  echo "ÉCHEC : la taille relue (${RECORD_HEIGHT}) ne correspond pas à celle envoyée (72.5)." >&2
  echo "Réponse du serveur : $GET_GROWTH_RESPONSE" >&2
  exit 1
fi
if [ "$RECORD_HEAD" != "44.1" ]; then
  echo "ÉCHEC : le périmètre crânien relu (${RECORD_HEAD}) ne correspond pas à celui envoyé (44.1)." >&2
  echo "Réponse du serveur : $GET_GROWTH_RESPONSE" >&2
  exit 1
fi
echo "OK : l'historique de croissance contient bien la mesure avec les valeurs attendues."

echo "Vérification du contrôle d'accès : labo1 doit être bloqué (403) sur POST /api/patients/${PATIENT_ID}/growth ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/growth" \
  -H "Authorization: Bearer ${LAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$GROWTH_PAYLOAD")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour labo1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : labo1 est bien bloqué (403) sur l'écriture d'une mesure de croissance."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  3x Observation (poids, taille, périmètre crânien) au 2024-05-15"
echo ""
echo "SUCCÈS : le module Croissance fonctionne de bout en bout via le backend, avec contrôle d'accès."
