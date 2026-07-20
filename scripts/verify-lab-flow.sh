#!/usr/bin/env bash
# Vérifie bout-en-bout le flux Pédiatrie → Laboratoire → retour médecin, en
# passant par le backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. POST d'un Patient fictif
#   3. POST d'une consultation (Encounter) pour ce patient
#   4. POST d'une demande d'examen (ServiceRequest) liée à la consultation
#   5. La demande apparaît dans la file d'attente du labo
#   6. POST d'un rapport (DiagnosticReport + Observations de résultat)
#   7. Relecture du dossier patient : le résultat doit être conforme

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
  "firstName": "Moussa",
  "lastName": "Verify-Lab-Flow",
  "birthDate": "2019-11-02",
  "gender": "male",
  "guardian": {
    "name": "Aminata Diallo",
    "relationship": "Mère",
    "phone": "+221709876543"
  }
}
JSON
)

echo "Création d'un Patient fictif (Moussa Verify-Lab-Flow) via POST /api/patients ..."
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

# --- 3. Création d'une consultation (Encounter) -----------------------------

ENCOUNTER_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Suspicion de paludisme",
  "vitals": {
    "temperature": 39.2,
    "weight": 15.5,
    "heartRate": 122
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

# --- 4. Demande d'examen (ServiceRequest) -----------------------------------

SERVICE_REQUEST_PAYLOAD=$(cat <<'JSON'
{
  "exam": "Goutte épaisse",
  "requester": "Dr. Verify-Lab-Flow"
}
JSON
)

echo "Création d'une demande d'examen via POST /api/encounters/${ENCOUNTER_ID}/service-requests ..."
POST_SERVICE_REQUEST_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/service-requests" \
  -H "Content-Type: application/json" \
  -d "$SERVICE_REQUEST_PAYLOAD")

SERVICE_REQUEST_ID=$(echo "$POST_SERVICE_REQUEST_RESPONSE" | jq -r '.serviceRequestId // empty')

if [ -z "$SERVICE_REQUEST_ID" ]; then
  echo "ÉCHEC : aucun serviceRequestId retourné par POST /api/encounters/${ENCOUNTER_ID}/service-requests." >&2
  echo "Réponse du serveur : $POST_SERVICE_REQUEST_RESPONSE" >&2
  exit 1
fi
echo "OK : demande d'examen créée avec l'id ${SERVICE_REQUEST_ID}."

# --- 5. La demande apparaît dans la file d'attente du labo ------------------

echo "Vérification de la file d'attente (GET /api/lab/requests) ..."
LAB_QUEUE_RESPONSE=$(curl -sf "${BACKEND_URL}/api/lab/requests")
FOUND_REQUEST_ID=$(echo "$LAB_QUEUE_RESPONSE" | jq -r --arg id "$SERVICE_REQUEST_ID" '.requests[] | select(.id == $id) | .id')

if [ "$FOUND_REQUEST_ID" != "$SERVICE_REQUEST_ID" ]; then
  echo "ÉCHEC : la demande d'examen n'apparaît pas dans la file d'attente du labo." >&2
  echo "Réponse du serveur : $LAB_QUEUE_RESPONSE" >&2
  exit 1
fi
echo "OK : la demande apparaît bien dans la file d'attente du labo."

# --- 6. Envoi du rapport (DiagnosticReport + Observations) ------------------

REPORT_PAYLOAD=$(cat <<'JSON'
{
  "results": [
    { "label": "Goutte épaisse", "value": "Positive P.falciparum" },
    { "label": "Hémoglobine", "value": "8.2 g/dL" }
  ],
  "conclusion": "Paludisme confirmé, anémie modérée."
}
JSON
)

echo "Envoi du rapport via POST /api/lab/requests/${SERVICE_REQUEST_ID}/report ..."
POST_REPORT_RESPONSE=$(curl -sf -X POST "${BACKEND_URL}/api/lab/requests/${SERVICE_REQUEST_ID}/report" \
  -H "Content-Type: application/json" \
  -d "$REPORT_PAYLOAD")

DIAGNOSTIC_REPORT_ID=$(echo "$POST_REPORT_RESPONSE" | jq -r '.diagnosticReportId // empty')

if [ -z "$DIAGNOSTIC_REPORT_ID" ]; then
  echo "ÉCHEC : aucun diagnosticReportId retourné par POST /api/lab/requests/${SERVICE_REQUEST_ID}/report." >&2
  echo "Réponse du serveur : $POST_REPORT_RESPONSE" >&2
  exit 1
fi
echo "OK : rapport créé avec l'id ${DIAGNOSTIC_REPORT_ID}."

# --- 7. Relecture côté patient -----------------------------------------------

echo "Relecture des résultats (GET /api/patients/${PATIENT_ID}/reports) ..."
GET_REPORTS_RESPONSE=$(curl -sf "${BACKEND_URL}/api/patients/${PATIENT_ID}/reports")

RECORD_CONCLUSION=$(echo "$GET_REPORTS_RESPONSE" | jq -r --arg id "$DIAGNOSTIC_REPORT_ID" '.reports[] | select(.id == $id) | .conclusion')
RECORD_RESULT_VALUE=$(echo "$GET_REPORTS_RESPONSE" | jq -r --arg id "$DIAGNOSTIC_REPORT_ID" '.reports[] | select(.id == $id) | .results[] | select(.label == "Goutte épaisse") | .value')

if [ "$RECORD_CONCLUSION" != "Paludisme confirmé, anémie modérée." ]; then
  echo "ÉCHEC : la conclusion relue ne correspond pas à celle envoyée." >&2
  echo "Réponse du serveur : $GET_REPORTS_RESPONSE" >&2
  exit 1
fi

if [ "$RECORD_RESULT_VALUE" != "Positive P.falciparum" ]; then
  echo "ÉCHEC : le résultat relu (${RECORD_RESULT_VALUE}) ne correspond pas à celui envoyé." >&2
  echo "Réponse du serveur : $GET_REPORTS_RESPONSE" >&2
  exit 1
fi

echo "OK : le dossier patient contient bien le rapport avec la conclusion et les résultats attendus."
echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_ID}"
echo "  ServiceRequest/${SERVICE_REQUEST_ID}"
echo "  DiagnosticReport/${DIAGNOSTIC_REPORT_ID}"
echo ""
echo "SUCCÈS : le flux Pédiatrie → Laboratoire → retour médecin fonctionne de bout en bout via le backend."
