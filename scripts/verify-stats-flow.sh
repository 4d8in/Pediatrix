#!/usr/bin/env bash
# Vérifie bout-en-bout la route /api/stats (statistiques calculées en direct
# depuis HAPI, indépendamment du worker reporting/Supabase), en passant par le
# backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. Relevé "avant" des compteurs (GET /api/stats, en tant que directeur1)
#   3. Création d'une ressource de chaque type compté : Patient, Encounter
#      (+Observation, ce mois-ci), ServiceRequest, DiagnosticReport
#      (+Observation), Immunization, MedicationRequest
#   4. Relevé "après" : les compteurs doivent avoir progressé d'au moins la
#      quantité créée (pas d'égalité stricte : le backend peut déjà porter des
#      données d'autres exécutions de verify-*.sh)
#   5. Le type d'examen créé ici apparaît dans la répartition par type
#   6. Les indicateurs non calculables (taux d'hospitalisation, durée moyenne
#      de séjour, lits occupés, charge par praticien) sont bien signalés
#      "non disponible", avec une raison, jamais une valeur inventée
#   7. Un rôle non autorisé (infirmière) est bloqué (403) sur GET /api/stats

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

echo "Connexion en tant que médecin1, labo1, directeur1 et infirmiere1 (POST /api/auth/login) ..."
DOCTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
LAB_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"labo1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
DIRECTOR_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"directeur1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')
NURSE_TOKEN=$(curl -sf -X POST "${BACKEND_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"infirmiere1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty')

if [ -z "$DOCTOR_TOKEN" ] || [ -z "$LAB_TOKEN" ] || [ -z "$DIRECTOR_TOKEN" ] || [ -z "$NURSE_TOKEN" ]; then
  echo "ÉCHEC : login medecin1/labo1/directeur1/infirmiere1 sans token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi
echo "OK : connecté en tant que médecin1, labo1, directeur1 et infirmiere1."

# --- Relevé "avant" -----------------------------------------------------------

echo "Relevé des compteurs avant création (GET /api/stats, en tant que directeur1) ..."
BEFORE_RESPONSE=$(curl -sf "${BACKEND_URL}/api/stats" -H "Authorization: Bearer ${DIRECTOR_TOKEN}")
BEFORE_PATIENTS=$(echo "$BEFORE_RESPONSE" | jq -r '.patients.total')
BEFORE_CONSULTATIONS=$(echo "$BEFORE_RESPONSE" | jq -r '.consultations.total')
BEFORE_CONSULTATIONS_MOIS=$(echo "$BEFORE_RESPONSE" | jq -r '.consultations.moisCourant')
BEFORE_DEMANDES=$(echo "$BEFORE_RESPONSE" | jq -r '.examens.demandes')
BEFORE_RESULTATS=$(echo "$BEFORE_RESPONSE" | jq -r '.examens.resultats')
BEFORE_VACCINATIONS=$(echo "$BEFORE_RESPONSE" | jq -r '.vaccinations.total')
BEFORE_PRESCRIPTIONS=$(echo "$BEFORE_RESPONSE" | jq -r '.prescriptions.total')
echo "OK : compteurs avant relevés (patients=${BEFORE_PATIENTS}, consultations=${BEFORE_CONSULTATIONS}, consultationsMois=${BEFORE_CONSULTATIONS_MOIS})."

# --- Création d'une ressource de chaque type comptée -------------------------

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Bineta",
  "lastName": "Verify-Stats-Flow",
  "birthDate": "2021-08-15",
  "gender": "female",
  "guardian": {
    "name": "Modou Sarr",
    "relationship": "Père",
    "phone": "+221703334455"
  }
}
JSON
)

echo "Création d'un Patient fictif (Bineta Verify-Stats-Flow) via POST /api/patients ..."
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
  "vitals": { "temperature": 37.0, "weight": 11.5 }
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
echo "OK : consultation créée avec l'id ${ENCOUNTER_ID} (ce mois-ci)."

EXAM_LABEL="Verify-Stats-Flow-Exam-$$"
SERVICE_REQUEST_PAYLOAD=$(jq -n --arg exam "$EXAM_LABEL" '{ exam: $exam, requester: "Dr. Verify-Stats-Flow" }')

echo "Création d'une demande d'examen via POST /api/encounters/${ENCOUNTER_ID}/service-requests ..."
SERVICE_REQUEST_ID=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/service-requests" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$SERVICE_REQUEST_PAYLOAD" | jq -r '.serviceRequestId // empty')

if [ -z "$SERVICE_REQUEST_ID" ]; then
  echo "ÉCHEC : aucun serviceRequestId retourné par POST /api/encounters/${ENCOUNTER_ID}/service-requests." >&2
  exit 1
fi
echo "OK : demande d'examen créée avec l'id ${SERVICE_REQUEST_ID} (type « ${EXAM_LABEL} »)."

REPORT_PAYLOAD=$(cat <<'JSON'
{
  "results": [{ "label": "Observation", "value": "Sans particularité" }],
  "conclusion": "RAS."
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
echo "OK : rapport créé avec l'id ${DIAGNOSTIC_REPORT_ID}."

IMMUNIZATION_PAYLOAD=$(cat <<'JSON'
{
  "vaccine": "Fièvre jaune",
  "date": "2024-05-01",
  "doseNumber": 1
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

# --- Relevé "après" (avec quelques essais espacés : l'index de recherche HAPI
# peut rester momentanément périmé juste après l'écriture, même constat que
# verify-lab-flow.sh) -----------------------------------------------------

echo "Relevé des compteurs après création (GET /api/stats, avec quelques essais espacés) ..."
STATS_MAX_ATTEMPTS=10
STATS_RETRY_DELAY=2
attempt=0
CHECK_OK=""
while [ "$attempt" -lt "$STATS_MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  AFTER_RESPONSE=$(curl -sf "${BACKEND_URL}/api/stats" -H "Authorization: Bearer ${DIRECTOR_TOKEN}")

  AFTER_PATIENTS=$(echo "$AFTER_RESPONSE" | jq -r '.patients.total')
  AFTER_CONSULTATIONS=$(echo "$AFTER_RESPONSE" | jq -r '.consultations.total')
  AFTER_CONSULTATIONS_MOIS=$(echo "$AFTER_RESPONSE" | jq -r '.consultations.moisCourant')
  AFTER_DEMANDES=$(echo "$AFTER_RESPONSE" | jq -r '.examens.demandes')
  AFTER_RESULTATS=$(echo "$AFTER_RESPONSE" | jq -r '.examens.resultats')
  AFTER_VACCINATIONS=$(echo "$AFTER_RESPONSE" | jq -r '.vaccinations.total')
  AFTER_PRESCRIPTIONS=$(echo "$AFTER_RESPONSE" | jq -r '.prescriptions.total')
  EXAM_TYPE_COUNT=$(echo "$AFTER_RESPONSE" | jq -r --arg examType "$EXAM_LABEL" '.examens.parType[$examType] // 0')

  if [ "$AFTER_PATIENTS" -ge $((BEFORE_PATIENTS + 1)) ] \
    && [ "$AFTER_CONSULTATIONS" -ge $((BEFORE_CONSULTATIONS + 1)) ] \
    && [ "$AFTER_CONSULTATIONS_MOIS" -ge $((BEFORE_CONSULTATIONS_MOIS + 1)) ] \
    && [ "$AFTER_DEMANDES" -ge $((BEFORE_DEMANDES + 1)) ] \
    && [ "$AFTER_RESULTATS" -ge $((BEFORE_RESULTATS + 1)) ] \
    && [ "$AFTER_VACCINATIONS" -ge $((BEFORE_VACCINATIONS + 1)) ] \
    && [ "$AFTER_PRESCRIPTIONS" -ge $((BEFORE_PRESCRIPTIONS + 1)) ] \
    && [ "$EXAM_TYPE_COUNT" -ge 1 ]; then
    CHECK_OK="1"
    break
  fi
  sleep "$STATS_RETRY_DELAY"
done

if [ -z "$CHECK_OK" ]; then
  echo "ÉCHEC : les compteurs de /api/stats n'ont pas progressé comme attendu après ${STATS_MAX_ATTEMPTS} tentatives." >&2
  echo "Avant : patients=${BEFORE_PATIENTS} consultations=${BEFORE_CONSULTATIONS} consultationsMois=${BEFORE_CONSULTATIONS_MOIS} demandes=${BEFORE_DEMANDES} resultats=${BEFORE_RESULTATS} vaccinations=${BEFORE_VACCINATIONS} prescriptions=${BEFORE_PRESCRIPTIONS}" >&2
  echo "Après  : patients=${AFTER_PATIENTS} consultations=${AFTER_CONSULTATIONS} consultationsMois=${AFTER_CONSULTATIONS_MOIS} demandes=${AFTER_DEMANDES} resultats=${AFTER_RESULTATS} vaccinations=${AFTER_VACCINATIONS} prescriptions=${AFTER_PRESCRIPTIONS} typeExamen(${EXAM_LABEL})=${EXAM_TYPE_COUNT}" >&2
  exit 1
fi
echo "OK : tous les compteurs ont progressé d'au moins la quantité créée (tentative ${attempt}/${STATS_MAX_ATTEMPTS})."
echo "OK : le type d'examen « ${EXAM_LABEL} » apparaît ${EXAM_TYPE_COUNT} fois dans la répartition par type."

# --- Indicateurs non disponibles ---------------------------------------------

echo "Vérification que les indicateurs non calculables sont signalés comme tels (pas de valeur inventée) ..."
for field in tauxHospitalisation dureeMoyenneSejour litsOccupes chargeParPraticien; do
  DISPONIBLE=$(echo "$AFTER_RESPONSE" | jq -r --arg f "$field" '.[$f].disponible')
  RAISON=$(echo "$AFTER_RESPONSE" | jq -r --arg f "$field" '.[$f].raison // empty')
  if [ "$DISPONIBLE" != "false" ] || [ -z "$RAISON" ]; then
    echo "ÉCHEC : l'indicateur ${field} devrait être { disponible: false, raison: <texte> }, reçu disponible=${DISPONIBLE} raison=\"${RAISON}\"." >&2
    exit 1
  fi
  echo "OK : ${field} signalé non disponible (raison : ${RAISON})."
done

# --- Contrôle d'accès ---------------------------------------------------------

echo "Vérification du contrôle d'accès : infirmiere1 doit être bloquée (403) sur GET /api/stats ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/stats" -H "Authorization: Bearer ${NURSE_TOKEN}")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour infirmiere1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : infirmiere1 est bien bloquée (403) sur /api/stats."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_ID}"
echo "  ServiceRequest/${SERVICE_REQUEST_ID}"
echo "  DiagnosticReport/${DIAGNOSTIC_REPORT_ID}"
echo "  Immunization/${IMMUNIZATION_ID}"
echo "  MedicationRequest/${PRESCRIPTION_ID}"
echo ""
echo "SUCCÈS : /api/stats calcule des compteurs réels depuis HAPI, signale honnêtement les indicateurs non disponibles, et applique le contrôle d'accès."
