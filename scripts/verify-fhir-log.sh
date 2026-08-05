#!/usr/bin/env bash
# Vérifie bout-en-bout la route /api/fhir-log (vitrine d'interopérabilité), en
# passant par le backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. Création d'au moins une ressource de chaque type interrogé par la route :
#      Patient, Encounter (+Observation), ServiceRequest, DiagnosticReport
#      (+Observation), Immunization, AllergyIntolerance, MedicationRequest
#   3. GET /api/fhir-log (admin technique) : tous les types attendus doivent
#      apparaître dans la réponse
#   4. Un rôle non autorisé (infirmière) est bloqué (403) sur /api/fhir-log

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

echo "Connexion en tant que médecin1, labo1, infirmiere1 et admin1 (POST /api/auth/login) ..."
DOCTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
LAB_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"labo1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
NURSE_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"infirmiere1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
ADMIN_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')

if [ -z "$DOCTOR_TOKEN" ] || [ -z "$LAB_TOKEN" ] || [ -z "$NURSE_TOKEN" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "ÉCHEC : login medecin1/labo1/infirmiere1/admin1 sans token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi
echo "OK : connecté en tant que médecin1, labo1, infirmiere1 et admin1."

# --- Création d'une ressource de chaque type -------------------------------

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Coumba",
  "lastName": "Verify-Fhir-Log",
  "birthDate": "2020-06-01",
  "gender": "female",
  "guardian": {
    "name": "Astou Ndour",
    "relationship": "Mère",
    "phone": "+221705554433"
  }
}
JSON
)

echo "Création d'un Patient fictif (Coumba Verify-Fhir-Log) via POST /api/patients ..."
PATIENT_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PATIENT_PAYLOAD" | jq -r '.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "ÉCHEC : aucune id retournée par POST /api/patients." >&2
  exit 1
fi
echo "OK : Patient créé avec l'id ${PATIENT_ID}."

ENCOUNTER_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Contrôle de routine",
  "vitals": {
    "temperature": 37.2,
    "weight": 12.4
  }
}
JSON
)

echo "Création d'une consultation via POST /api/patients/${PATIENT_ID}/encounters ..."
ENCOUNTER_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$ENCOUNTER_PAYLOAD" | jq -r '.encounterId // empty')

if [ -z "$ENCOUNTER_ID" ]; then
  echo "ÉCHEC : aucun encounterId retourné par POST /api/patients/${PATIENT_ID}/encounters." >&2
  exit 1
fi
echo "OK : consultation créée avec l'id ${ENCOUNTER_ID} (produit aussi Observation)."

SERVICE_REQUEST_PAYLOAD=$(cat <<'JSON'
{
  "exam": "NFS",
  "requester": "Dr. Verify-Fhir-Log"
}
JSON
)

echo "Création d'une demande d'examen via POST /api/encounters/${ENCOUNTER_ID}/service-requests ..."
SERVICE_REQUEST_ID=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/service-requests" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$SERVICE_REQUEST_PAYLOAD" | jq -r '.serviceRequestId // empty')

if [ -z "$SERVICE_REQUEST_ID" ]; then
  echo "ÉCHEC : aucun serviceRequestId retourné par POST /api/encounters/${ENCOUNTER_ID}/service-requests." >&2
  exit 1
fi
echo "OK : demande d'examen créée avec l'id ${SERVICE_REQUEST_ID}."

REPORT_PAYLOAD=$(cat <<'JSON'
{
  "results": [{ "label": "Hémoglobine", "value": "11.8 g/dL" }],
  "conclusion": "Sans anomalie."
}
JSON
)

echo "Envoi du rapport via POST /api/lab/requests/${SERVICE_REQUEST_ID}/report ..."
DIAGNOSTIC_REPORT_ID=$(curl -sf -X POST "${BACKEND_URL}/api/lab/requests/${SERVICE_REQUEST_ID}/report" \
  -H "Authorization: Bearer ${LAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$REPORT_PAYLOAD" | jq -r '.diagnosticReportId // empty')

if [ -z "$DIAGNOSTIC_REPORT_ID" ]; then
  echo "ÉCHEC : aucun diagnosticReportId retourné par POST /api/lab/requests/${SERVICE_REQUEST_ID}/report." >&2
  exit 1
fi
echo "OK : rapport créé avec l'id ${DIAGNOSTIC_REPORT_ID} (produit aussi Observation)."

IMMUNIZATION_PAYLOAD=$(cat <<'JSON'
{
  "vaccine": "Pentavalent",
  "date": "2024-03-01",
  "doseNumber": 2
}
JSON
)

echo "Enregistrement d'un vaccin via POST /api/patients/${PATIENT_ID}/immunizations ..."
IMMUNIZATION_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/immunizations" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$IMMUNIZATION_PAYLOAD" | jq -r '.immunizationId // empty')

if [ -z "$IMMUNIZATION_ID" ]; then
  echo "ÉCHEC : aucun immunizationId retourné par POST /api/patients/${PATIENT_ID}/immunizations." >&2
  exit 1
fi
echo "OK : vaccin créé avec l'id ${IMMUNIZATION_ID}."

ALLERGY_PAYLOAD=$(cat <<'JSON'
{
  "substance": "Arachide",
  "reaction": "Urticaire"
}
JSON
)

echo "Déclaration d'une allergie via POST /api/patients/${PATIENT_ID}/allergies ..."
ALLERGY_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/allergies" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$ALLERGY_PAYLOAD" | jq -r '.allergyId // empty')

if [ -z "$ALLERGY_ID" ]; then
  echo "ÉCHEC : aucun allergyId retourné par POST /api/patients/${PATIENT_ID}/allergies." >&2
  exit 1
fi
echo "OK : allergie créée avec l'id ${ALLERGY_ID}."

# Médicament volontairement distinct de l'allergie déclarée ci-dessus : ce
# script vérifie /api/fhir-log, pas le contrôle d'allergie (voir
# verify-prescription-flow.sh pour ce dernier).
PRESCRIPTION_PAYLOAD=$(cat <<'JSON'
{
  "medication": "Paracétamol",
  "dosage": "5ml x 3/j pendant 3 jours"
}
JSON
)

echo "Création d'une prescription via POST /api/encounters/${ENCOUNTER_ID}/prescriptions ..."
PRESCRIPTION_ID=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/prescriptions" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PRESCRIPTION_PAYLOAD" | jq -r '.prescriptionId // empty')

if [ -z "$PRESCRIPTION_ID" ]; then
  echo "ÉCHEC : aucun prescriptionId retourné par POST /api/encounters/${ENCOUNTER_ID}/prescriptions." >&2
  exit 1
fi
echo "OK : prescription créée avec l'id ${PRESCRIPTION_ID}."

# --- Vérification de /api/fhir-log ------------------------------------------
# La route interroge chaque type séparément avec _count=5 : une ressource tout
# juste créée peut rester momentanément absente de l'index de recherche HAPI
# (même constat que verify-lab-flow.sh). On retente plusieurs fois.

EXPECTED_TYPES="Patient Encounter Observation ServiceRequest DiagnosticReport Immunization AllergyIntolerance MedicationRequest"

echo "Vérification de GET /api/fhir-log (admin1, avec quelques essais espacés) ..."
FHIR_LOG_MAX_ATTEMPTS=10
FHIR_LOG_RETRY_DELAY=2
MISSING_TYPES=""
attempt=0
while [ "$attempt" -lt "$FHIR_LOG_MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  FHIR_LOG_RESPONSE=$(curl -sf "${BACKEND_URL}/api/fhir-log" -H "Authorization: Bearer ${ADMIN_TOKEN}")
  PRESENT_TYPES=$(echo "$FHIR_LOG_RESPONSE" | jq -r '.resources[].type' | sort -u)

  MISSING_TYPES=""
  for type in $EXPECTED_TYPES; do
    if ! echo "$PRESENT_TYPES" | grep -qx "$type"; then
      MISSING_TYPES="${MISSING_TYPES} ${type}"
    fi
  done

  if [ -z "$MISSING_TYPES" ]; then
    break
  fi
  sleep "$FHIR_LOG_RETRY_DELAY"
done

if [ -n "$MISSING_TYPES" ]; then
  echo "ÉCHEC : type(s) absent(s) de GET /api/fhir-log après ${FHIR_LOG_MAX_ATTEMPTS} tentatives :${MISSING_TYPES}" >&2
  echo "Types présents : $(echo "$PRESENT_TYPES" | tr '\n' ' ')" >&2
  exit 1
fi
echo "OK : les 8 types attendus apparaissent dans /api/fhir-log (tentative ${attempt}/${FHIR_LOG_MAX_ATTEMPTS})."
echo "Types présents : $(echo "$PRESENT_TYPES" | tr '\n' ' ')"

# --- Contrôle d'accès --------------------------------------------------------

echo "Vérification du contrôle d'accès : infirmiere1 doit être bloquée (403) sur GET /api/fhir-log ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/fhir-log" -H "Authorization: Bearer ${NURSE_TOKEN}")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour infirmiere1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : infirmiere1 est bien bloquée (403) sur /api/fhir-log."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_ID}"
echo "  ServiceRequest/${SERVICE_REQUEST_ID}"
echo "  DiagnosticReport/${DIAGNOSTIC_REPORT_ID}"
echo "  Immunization/${IMMUNIZATION_ID}"
echo "  AllergyIntolerance/${ALLERGY_ID}"
echo "  MedicationRequest/${PRESCRIPTION_ID}"
echo ""
echo "SUCCÈS : /api/fhir-log expose bien les 8 types de ressources, avec contrôle d'accès."
