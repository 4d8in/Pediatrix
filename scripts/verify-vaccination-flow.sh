#!/usr/bin/env bash
# Vérifie bout-en-bout le module Vaccination (Immunization), en passant par le
# backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif
#   3. POST d'un vaccin (Immunization) pour ce patient, en tant que médecin
#   4. Relecture du carnet vaccinal : le vaccin doit être conforme
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
  "firstName": "Fatima",
  "lastName": "Verify-Vaccination-Flow",
  "birthDate": "2024-02-10",
  "gender": "female",
  "guardian": {
    "name": "Ousmane Ba",
    "relationship": "Père",
    "phone": "+221701234567"
  }
}
JSON
)

echo "Création d'un Patient fictif (Fatima Verify-Vaccination-Flow) via POST /api/patients ..."
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

IMMUNIZATION_PAYLOAD=$(cat <<'JSON'
{
  "vaccine": "BCG",
  "date": "2024-02-11",
  "doseNumber": 1
}
JSON
)

echo "Enregistrement d'un vaccin via POST /api/patients/${PATIENT_ID}/immunizations ..."
POST_IMMUNIZATION_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/immunizations" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$IMMUNIZATION_PAYLOAD")

IMMUNIZATION_ID=$(echo "$POST_IMMUNIZATION_RESPONSE" | jq -r '.immunizationId // empty')

if [ -z "$IMMUNIZATION_ID" ]; then
  echo "ÉCHEC : aucun immunizationId retourné par POST /api/patients/${PATIENT_ID}/immunizations." >&2
  echo "Réponse du serveur : $POST_IMMUNIZATION_RESPONSE" >&2
  exit 1
fi
echo "OK : vaccin créé avec l'id ${IMMUNIZATION_ID}."

echo "Relecture du carnet vaccinal (GET /api/patients/${PATIENT_ID}/immunizations) ..."
GET_IMMUNIZATIONS_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/immunizations" -H "Authorization: Bearer ${DOCTOR_TOKEN}")

RECORD_VACCINE=$(echo "$GET_IMMUNIZATIONS_RESPONSE" | jq -r --arg id "$IMMUNIZATION_ID" '.immunizations[] | select(.id == $id) | .vaccine')
RECORD_DOSE=$(echo "$GET_IMMUNIZATIONS_RESPONSE" | jq -r --arg id "$IMMUNIZATION_ID" '.immunizations[] | select(.id == $id) | .doseNumber')

if [ "$RECORD_VACCINE" != "BCG" ]; then
  echo "ÉCHEC : le vaccin relu (${RECORD_VACCINE}) ne correspond pas à celui envoyé (BCG)." >&2
  echo "Réponse du serveur : $GET_IMMUNIZATIONS_RESPONSE" >&2
  exit 1
fi

if [ "$RECORD_DOSE" != "1" ]; then
  echo "ÉCHEC : la dose relue (${RECORD_DOSE}) ne correspond pas à celle envoyée (1)." >&2
  echo "Réponse du serveur : $GET_IMMUNIZATIONS_RESPONSE" >&2
  exit 1
fi
echo "OK : le carnet vaccinal contient bien le vaccin avec la dose attendue."

echo "Vérification du contrôle d'accès : labo1 doit être bloqué (403) sur POST /api/patients/${PATIENT_ID}/immunizations ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/immunizations" \
  -H "Authorization: Bearer ${LAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$IMMUNIZATION_PAYLOAD")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour labo1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : labo1 est bien bloqué (403) sur l'écriture d'un vaccin."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Immunization/${IMMUNIZATION_ID}"
echo ""
echo "SUCCÈS : le module Vaccination fonctionne de bout en bout via le backend, avec contrôle d'accès."
