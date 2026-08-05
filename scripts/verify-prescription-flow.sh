#!/usr/bin/env bash
# Vérifie bout-en-bout le module Prescription (AllergyIntolerance +
# MedicationRequest), en passant par le backend uniquement (jamais HAPI
# directement) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif + d'une consultation (Encounter)
#   3. Déclaration d'une allergie connue (AllergyIntolerance)
#   4. Tentative de prescription du médicament allergène sans confirmation
#      → doit être refusée (409, requiresConfirmation)
#   5. Même prescription avec confirmed:true → doit être acceptée
#   6. Relecture du dossier patient : la prescription doit porter l'indicateur
#      de confirmation malgré allergie
#   7. Un rôle non autorisé (infirmière) est bloqué (403) sur la création
#      d'une prescription

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

echo "Connexion en tant que médecin1 et infirmiere1 (POST /api/auth/login) ..."
DOCTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
NURSE_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"infirmiere1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')

if [ -z "$DOCTOR_TOKEN" ] || [ -z "$NURSE_TOKEN" ]; then
  echo "ÉCHEC : login medecin1/infirmiere1 sans token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi
echo "OK : connecté en tant que médecin1 et infirmiere1."

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Aissatou",
  "lastName": "Verify-Prescription-Flow",
  "birthDate": "2022-09-20",
  "gender": "female",
  "guardian": {
    "name": "Mamadou Diop",
    "relationship": "Père",
    "phone": "+221706667788"
  }
}
JSON
)

echo "Création d'un Patient fictif (Aissatou Verify-Prescription-Flow) via POST /api/patients ..."
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

ENCOUNTER_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Fièvre et toux",
  "vitals": {
    "temperature": 38.6
  }
}
JSON
)

echo "Création d'une consultation via POST /api/patients/${PATIENT_ID}/encounters ..."
POST_ENCOUNTER_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$ENCOUNTER_PAYLOAD")

ENCOUNTER_ID=$(echo "$POST_ENCOUNTER_RESPONSE" | jq -r '.encounterId // empty')

if [ -z "$ENCOUNTER_ID" ]; then
  echo "ÉCHEC : aucun encounterId retourné par POST /api/patients/${PATIENT_ID}/encounters." >&2
  echo "Réponse du serveur : $POST_ENCOUNTER_RESPONSE" >&2
  exit 1
fi
echo "OK : consultation créée avec l'id ${ENCOUNTER_ID}."

ALLERGY_PAYLOAD=$(cat <<'JSON'
{
  "substance": "Amoxicilline",
  "reaction": "Éruption cutanée"
}
JSON
)

echo "Déclaration d'une allergie connue via POST /api/patients/${PATIENT_ID}/allergies ..."
POST_ALLERGY_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/allergies" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$ALLERGY_PAYLOAD")

ALLERGY_ID=$(echo "$POST_ALLERGY_RESPONSE" | jq -r '.allergyId // empty')

if [ -z "$ALLERGY_ID" ]; then
  echo "ÉCHEC : aucun allergyId retourné par POST /api/patients/${PATIENT_ID}/allergies." >&2
  echo "Réponse du serveur : $POST_ALLERGY_RESPONSE" >&2
  exit 1
fi
echo "OK : allergie créée avec l'id ${ALLERGY_ID}."

PRESCRIPTION_PAYLOAD=$(cat <<'JSON'
{
  "medication": "Amoxicilline",
  "dosage": "5ml x 3/j pendant 7 jours"
}
JSON
)

echo "Tentative de prescription du médicament allergène SANS confirmation (doit échouer avec 409) ..."
CONFLICT_STATUS=$(curl -s -o /tmp/pedcx-prescription-conflict.json -w "%{http_code}" \
  -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/prescriptions" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PRESCRIPTION_PAYLOAD")

if [ "$CONFLICT_STATUS" != "409" ]; then
  echo "ÉCHEC : attendu 409 (conflit d'allergie), reçu ${CONFLICT_STATUS}." >&2
  echo "Réponse du serveur : $(cat /tmp/pedcx-prescription-conflict.json)" >&2
  exit 1
fi

REQUIRES_CONFIRMATION=$(jq -r '.requiresConfirmation // false' /tmp/pedcx-prescription-conflict.json)
CONFLICT_ALLERGY=$(jq -r '.allergy // empty' /tmp/pedcx-prescription-conflict.json)

if [ "$REQUIRES_CONFIRMATION" != "true" ] || [ "$CONFLICT_ALLERGY" != "Amoxicilline" ]; then
  echo "ÉCHEC : réponse 409 inattendue (requiresConfirmation=${REQUIRES_CONFIRMATION}, allergy=${CONFLICT_ALLERGY})." >&2
  echo "Réponse du serveur : $(cat /tmp/pedcx-prescription-conflict.json)" >&2
  exit 1
fi
rm -f /tmp/pedcx-prescription-conflict.json
echo "OK : la prescription a bien été refusée avec un avertissement d'allergie, sans être enregistrée."

CONFIRMED_PAYLOAD=$(cat <<'JSON'
{
  "medication": "Amoxicilline",
  "dosage": "5ml x 3/j pendant 7 jours",
  "confirmed": true
}
JSON
)

echo "Renvoi de la même prescription avec confirmed:true (doit réussir) ..."
POST_PRESCRIPTION_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/prescriptions" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$CONFIRMED_PAYLOAD")

PRESCRIPTION_ID=$(echo "$POST_PRESCRIPTION_RESPONSE" | jq -r '.prescriptionId // empty')

if [ -z "$PRESCRIPTION_ID" ]; then
  echo "ÉCHEC : aucun prescriptionId retourné après confirmation." >&2
  echo "Réponse du serveur : $POST_PRESCRIPTION_RESPONSE" >&2
  exit 1
fi
echo "OK : prescription créée avec l'id ${PRESCRIPTION_ID} après confirmation."

echo "Relecture du dossier patient (GET /api/patients/${PATIENT_ID}/prescriptions) ..."
GET_PRESCRIPTIONS_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/prescriptions" -H "Authorization: Bearer ${DOCTOR_TOKEN}")

RECORD_MEDICATION=$(echo "$GET_PRESCRIPTIONS_RESPONSE" | jq -r --arg id "$PRESCRIPTION_ID" '.prescriptions[] | select(.id == $id) | .medication')
RECORD_OVERRIDE=$(echo "$GET_PRESCRIPTIONS_RESPONSE" | jq -r --arg id "$PRESCRIPTION_ID" '.prescriptions[] | select(.id == $id) | .allergyOverrideConfirmed')

if [ "$RECORD_MEDICATION" != "Amoxicilline" ]; then
  echo "ÉCHEC : le médicament relu (${RECORD_MEDICATION}) ne correspond pas à celui envoyé (Amoxicilline)." >&2
  echo "Réponse du serveur : $GET_PRESCRIPTIONS_RESPONSE" >&2
  exit 1
fi
if [ "$RECORD_OVERRIDE" != "true" ]; then
  echo "ÉCHEC : l'indicateur de confirmation malgré allergie n'est pas enregistré (allergyOverrideConfirmed=${RECORD_OVERRIDE})." >&2
  echo "Réponse du serveur : $GET_PRESCRIPTIONS_RESPONSE" >&2
  exit 1
fi
echo "OK : le dossier patient contient bien la prescription avec l'indicateur de confirmation d'allergie."

echo "Vérification du contrôle d'accès : infirmiere1 doit être bloquée (403) sur POST /api/encounters/${ENCOUNTER_ID}/prescriptions ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/prescriptions" \
  -H "Authorization: Bearer ${NURSE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$CONFIRMED_PAYLOAD")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour infirmiere1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : infirmiere1 est bien bloquée (403) sur la création d'une prescription."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_ID}"
echo "  AllergyIntolerance/${ALLERGY_ID}"
echo "  MedicationRequest/${PRESCRIPTION_ID}"
echo ""
echo "SUCCÈS : le module Prescription fonctionne de bout en bout via le backend, avec contrôle d'allergie et contrôle d'accès."
