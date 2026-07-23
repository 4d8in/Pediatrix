#!/usr/bin/env bash
# Vérifie bout-en-bout le flux Pédiatrie → Radiologie → retour médecin, calqué
# sur scripts/verify-lab-flow.sh (module Laboratoire) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif
#   3. POST d'une consultation (Encounter) pour ce patient
#   4. POST d'une demande d'imagerie (ServiceRequest, catégorie imagerie)
#   5. La demande apparaît dans la file d'attente de la radiologie
#   6. POST d'un compte-rendu (DiagnosticReport + Observations)
#   7. Relecture du dossier patient : le compte-rendu doit être conforme,
#      ET absent de la file/des résultats du module Laboratoire.

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

# --- 2. Authentification (médecin1 + radiologue1) ---------------------------
# Nécessite d'avoir lancé scripts/seed-users.sh au préalable (radiologue1 y a
# été ajouté avec le rôle radiologist).

if [ -z "${SEED_USER_PASSWORD:-}" ] && [ -f apps/backend/.env ]; then
  SEED_USER_PASSWORD="$(grep -E '^SEED_USER_PASSWORD=' apps/backend/.env | tail -n1 | cut -d'=' -f2-)"
fi
if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  echo "ÉCHEC : SEED_USER_PASSWORD introuvable (ni en variable d'env, ni dans apps/backend/.env)." >&2
  exit 1
fi

echo "Connexion en tant que médecin1 et radiologue1 (POST /api/auth/login) ..."
DOCTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
RADIOLOGY_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"radiologue1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')

if [ -z "$DOCTOR_TOKEN" ] || [ -z "$RADIOLOGY_TOKEN" ]; then
  echo "ÉCHEC : login medecin1/radiologue1 sans token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi
echo "OK : connecté en tant que médecin1 et radiologue1."

# --- 3. Création d'un Patient fictif ---------------------------------------

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Awa",
  "lastName": "Verify-Imaging-Flow",
  "birthDate": "2018-04-14",
  "gender": "female",
  "guardian": {
    "name": "Ousmane Fall",
    "relationship": "Père",
    "phone": "+221701234567"
  }
}
JSON
)

echo "Création d'un Patient fictif (Awa Verify-Imaging-Flow) via POST /api/patients ..."
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

# --- 4. Création d'une consultation (Encounter) -----------------------------

ENCOUNTER_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Suspicion de pneumonie",
  "vitals": {
    "temperature": 38.7,
    "weight": 13.2,
    "respiratoryRate": 34
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

# --- 5. Demande d'imagerie (ServiceRequest, catégorie imagerie) -------------

IMAGING_REQUEST_PAYLOAD=$(cat <<'JSON'
{
  "exam": "Radiographie thoracique",
  "requester": "Dr. Verify-Imaging-Flow"
}
JSON
)

echo "Création d'une demande d'imagerie via POST /api/encounters/${ENCOUNTER_ID}/imaging-requests ..."
POST_IMAGING_REQUEST_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/imaging-requests" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$IMAGING_REQUEST_PAYLOAD")

IMAGING_REQUEST_ID=$(echo "$POST_IMAGING_REQUEST_RESPONSE" | jq -r '.imagingRequestId // empty')

if [ -z "$IMAGING_REQUEST_ID" ]; then
  echo "ÉCHEC : aucun imagingRequestId retourné par POST /api/encounters/${ENCOUNTER_ID}/imaging-requests." >&2
  echo "Réponse du serveur : $POST_IMAGING_REQUEST_RESPONSE" >&2
  exit 1
fi
echo "OK : demande d'imagerie créée avec l'id ${IMAGING_REQUEST_ID}."

# --- 6. La demande apparaît dans la file d'attente de la radiologie ---------
# Même délai HAPI potentiel que pour le labo (voir verify-lab-flow.sh) : on
# retente plusieurs fois, en vérifiant PRÉCISÉMENT l'id créé.

echo "Vérification de la file d'attente (GET /api/imaging/requests, avec quelques essais espacés) ..."
QUEUE_MAX_ATTEMPTS=10
QUEUE_RETRY_DELAY=2
FOUND_REQUEST_ID=""
attempt=0
while [ "$attempt" -lt "$QUEUE_MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  IMAGING_QUEUE_RESPONSE=$(curl -sf "${BACKEND_URL}/api/imaging/requests" -H "Authorization: Bearer ${RADIOLOGY_TOKEN}")
  FOUND_REQUEST_ID=$(echo "$IMAGING_QUEUE_RESPONSE" | jq -r --arg id "$IMAGING_REQUEST_ID" '.requests[] | select(.id == $id) | .id')
  if [ "$FOUND_REQUEST_ID" = "$IMAGING_REQUEST_ID" ]; then
    break
  fi
  sleep "$QUEUE_RETRY_DELAY"
done

if [ "$FOUND_REQUEST_ID" != "$IMAGING_REQUEST_ID" ]; then
  echo "ÉCHEC : la demande d'imagerie ${IMAGING_REQUEST_ID} n'apparaît toujours pas dans la file d'attente après ${QUEUE_MAX_ATTEMPTS} tentatives (${QUEUE_RETRY_DELAY}s d'intervalle)." >&2
  echo "Réponse du serveur : $IMAGING_QUEUE_RESPONSE" >&2
  exit 1
fi
echo "OK : la demande ${IMAGING_REQUEST_ID} apparaît bien dans la file d'attente de la radiologie (tentative ${attempt}/${QUEUE_MAX_ATTEMPTS})."

# --- 6bis. Preuve de modularité : la demande N'apparaît PAS dans la file labo -

echo "Vérification que la demande d'imagerie n'apparaît PAS dans la file du laboratoire (GET /api/lab/requests) ..."
LAB_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"labo1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
LAB_QUEUE_RESPONSE=$(curl -sf "${BACKEND_URL}/api/lab/requests" -H "Authorization: Bearer ${LAB_TOKEN}")
LEAKED_ID=$(echo "$LAB_QUEUE_RESPONSE" | jq -r --arg id "$IMAGING_REQUEST_ID" '.requests[] | select(.id == $id) | .id')

if [ -n "$LEAKED_ID" ]; then
  echo "ÉCHEC : la demande d'imagerie ${IMAGING_REQUEST_ID} apparaît dans la file du laboratoire (fuite entre modules)." >&2
  exit 1
fi
echo "OK : la file du laboratoire ne contient pas la demande d'imagerie."

# --- 7. Envoi du compte-rendu (DiagnosticReport + Observations) ------------

REPORT_PAYLOAD=$(cat <<'JSON'
{
  "results": [
    { "label": "Poumons", "value": "Foyer de condensation base droite" },
    { "label": "Silhouette cardiaque", "value": "Normale" }
  ],
  "conclusion": "Aspect radiologique compatible avec une pneumonie basale droite."
}
JSON
)

echo "Envoi du compte-rendu via POST /api/imaging/requests/${IMAGING_REQUEST_ID}/report ..."
POST_REPORT_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/imaging/requests/${IMAGING_REQUEST_ID}/report" \
  -H "Authorization: Bearer ${RADIOLOGY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$REPORT_PAYLOAD")

DIAGNOSTIC_REPORT_ID=$(echo "$POST_REPORT_RESPONSE" | jq -r '.diagnosticReportId // empty')

if [ -z "$DIAGNOSTIC_REPORT_ID" ]; then
  echo "ÉCHEC : aucun diagnosticReportId retourné par POST /api/imaging/requests/${IMAGING_REQUEST_ID}/report." >&2
  echo "Réponse du serveur : $POST_REPORT_RESPONSE" >&2
  exit 1
fi
echo "OK : compte-rendu créé avec l'id ${DIAGNOSTIC_REPORT_ID}."

# --- 8. Relecture côté patient (endpoint imagerie) --------------------------

echo "Relecture des comptes-rendus (GET /api/patients/${PATIENT_ID}/imaging-reports) ..."
GET_IMAGING_REPORTS_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/imaging-reports" -H "Authorization: Bearer ${DOCTOR_TOKEN}")

RECORD_CONCLUSION=$(echo "$GET_IMAGING_REPORTS_RESPONSE" | jq -r --arg id "$DIAGNOSTIC_REPORT_ID" '.reports[] | select(.id == $id) | .conclusion')
RECORD_RESULT_VALUE=$(echo "$GET_IMAGING_REPORTS_RESPONSE" | jq -r --arg id "$DIAGNOSTIC_REPORT_ID" '.reports[] | select(.id == $id) | .results[] | select(.label == "Poumons") | .value')

if [ "$RECORD_CONCLUSION" != "Aspect radiologique compatible avec une pneumonie basale droite." ]; then
  echo "ÉCHEC : la conclusion relue ne correspond pas à celle envoyée." >&2
  echo "Réponse du serveur : $GET_IMAGING_REPORTS_RESPONSE" >&2
  exit 1
fi

if [ "$RECORD_RESULT_VALUE" != "Foyer de condensation base droite" ]; then
  echo "ÉCHEC : le résultat relu (${RECORD_RESULT_VALUE}) ne correspond pas à celui envoyé." >&2
  echo "Réponse du serveur : $GET_IMAGING_REPORTS_RESPONSE" >&2
  exit 1
fi
echo "OK : le dossier patient (imagerie) contient bien le compte-rendu attendu."

# --- 8bis. Preuve de modularité : le compte-rendu N'apparaît PAS côté labo --

echo "Vérification que le compte-rendu n'apparaît PAS dans /api/patients/${PATIENT_ID}/reports (labo) ..."
GET_LAB_REPORTS_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/reports" -H "Authorization: Bearer ${DOCTOR_TOKEN}")
LEAKED_REPORT_ID=$(echo "$GET_LAB_REPORTS_RESPONSE" | jq -r --arg id "$DIAGNOSTIC_REPORT_ID" '.reports[] | select(.id == $id) | .id')

if [ -n "$LEAKED_REPORT_ID" ]; then
  echo "ÉCHEC : le compte-rendu d'imagerie ${DIAGNOSTIC_REPORT_ID} apparaît dans les résultats de laboratoire (fuite entre modules)." >&2
  exit 1
fi
echo "OK : les résultats de laboratoire ne contiennent pas le compte-rendu d'imagerie."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_ID}"
echo "  ServiceRequest/${IMAGING_REQUEST_ID}"
echo "  DiagnosticReport/${DIAGNOSTIC_REPORT_ID}"
echo ""
echo "SUCCÈS : le flux Pédiatrie → Radiologie → retour médecin fonctionne de bout en bout via le backend, sans interférence avec le module Laboratoire."
