#!/usr/bin/env bash
# Vérifie bout-en-bout le flux Admission → Consultation, en passant par le
# backend uniquement (jamais HAPI directement — c'est ce que fait le frontend) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif, retrouvé par recherche par nom
#   3. POST d'une consultation (Encounter + Observations vitaux) pour ce patient
#   4. Relecture du dossier patient : motif et vitaux doivent être conformes

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_URL="http://localhost:3001"
MAX_ATTEMPTS=30

# --- Dépendances ---------------------------------------------------------

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

# --- 1. Attente du backend ------------------------------------------------

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

# --- 2. Création d'un Patient fictif ---------------------------------------

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Astou",
  "lastName": "Verify-Admission",
  "birthDate": "2021-03-14",
  "gender": "female",
  "guardian": {
    "name": "Fatou Ndiaye",
    "relationship": "Mère",
    "phone": "+221701234567"
  }
}
JSON
)

echo "Création d'un Patient fictif (Astou Verify-Admission) via POST /api/patients ..."
POST_PATIENT_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients" \
  -H "Content-Type: application/json" \
  -d "$PATIENT_PAYLOAD")

PATIENT_ID=$(echo "$POST_PATIENT_RESPONSE" | jq -r '.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "ÉCHEC : aucune id retournée par POST /api/patients." >&2
  echo "Réponse du serveur : $POST_PATIENT_RESPONSE" >&2
  exit 1
fi
echo "OK : Patient créé avec l'id ${PATIENT_ID}."

# --- 3. Recherche par nom ---------------------------------------------------

echo "Recherche du patient par nom (GET /api/patients?search=Verify-Admission) ..."
SEARCH_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients?search=Verify-Admission")
FOUND_ID=$(echo "$SEARCH_RESPONSE" | jq -r --arg id "$PATIENT_ID" '.patients[] | select(.id == $id) | .id')

if [ "$FOUND_ID" != "$PATIENT_ID" ]; then
  echo "ÉCHEC : le patient créé n'apparaît pas dans la recherche par nom." >&2
  echo "Réponse du serveur : $SEARCH_RESPONSE" >&2
  exit 1
fi
echo "OK : le patient est bien retrouvé par recherche sur le nom."

# --- 4. Création d'une consultation (Encounter + Observations) -------------

ENCOUNTER_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Fièvre persistante depuis 3 jours",
  "notes": "Enfant abattu, pas de signe de déshydratation.",
  "vitals": {
    "temperature": 38.7,
    "weight": 14.2,
    "height": 92,
    "heartRate": 118,
    "respiratoryRate": 30
  }
}
JSON
)

echo "Création d'une consultation via POST /api/patients/${PATIENT_ID}/encounters ..."
POST_ENCOUNTER_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" \
  -H "Content-Type: application/json" \
  -d "$ENCOUNTER_PAYLOAD")

ENCOUNTER_ID=$(echo "$POST_ENCOUNTER_RESPONSE" | jq -r '.encounterId // empty')

if [ -z "$ENCOUNTER_ID" ]; then
  echo "ÉCHEC : aucun encounterId retourné par POST /api/patients/${PATIENT_ID}/encounters." >&2
  echo "Réponse du serveur : $POST_ENCOUNTER_RESPONSE" >&2
  exit 1
fi
echo "OK : consultation créée avec l'id ${ENCOUNTER_ID}."

# --- 5. Relecture du dossier patient ----------------------------------------

echo "Relecture du dossier patient (GET /api/patients/${PATIENT_ID}) ..."
GET_RECORD_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}")

RECORD_REASON=$(echo "$GET_RECORD_RESPONSE" | jq -r --arg id "$ENCOUNTER_ID" '.consultations[] | select(.id == $id) | .reason')
RECORD_TEMPERATURE=$(echo "$GET_RECORD_RESPONSE" | jq -r --arg id "$ENCOUNTER_ID" '.consultations[] | select(.id == $id) | .vitals.temperature')

if [ "$RECORD_REASON" != "Fièvre persistante depuis 3 jours" ]; then
  echo "ÉCHEC : le motif relu ne correspond pas à celui envoyé." >&2
  echo "Réponse du serveur : $GET_RECORD_RESPONSE" >&2
  exit 1
fi

if [ "$RECORD_TEMPERATURE" != "38.7" ]; then
  echo "ÉCHEC : la température relue (${RECORD_TEMPERATURE}) ne correspond pas à celle envoyée (38.7)." >&2
  echo "Réponse du serveur : $GET_RECORD_RESPONSE" >&2
  exit 1
fi

echo "OK : le dossier patient contient bien la consultation avec le motif et les vitaux attendus."
echo ""
echo "SUCCÈS : le flux Admission → Consultation fonctionne de bout en bout via le backend."
