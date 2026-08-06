#!/usr/bin/env bash
# Vérifie bout-en-bout la route /api/dashboard/counters, en passant par le
# backend uniquement (jamais HAPI directement) :
#   1. Le backend répond sur /api/health
#   2. Relevé "avant" (GET /api/dashboard/counters, en tant que médecin1)
#   3. Création d'une consultation du jour SANS vitaux : le compteur
#      « paramètres vitaux à prendre » doit augmenter d'au moins 1
#   4. Création d'une seconde consultation du jour AVEC vitaux : le compteur ne
#      doit PAS augmenter davantage (cette consultation-là est déjà couverte)
#   5. « hospitalisés » est bien signalé "non disponible", avec une raison
#   6. Un rôle non autorisé (technicien labo) est bloqué (403)

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

echo "Relevé des compteurs avant création (GET /api/dashboard/counters, en tant que médecin1) ..."
BEFORE_RESPONSE=$(curl -sf "${BACKEND_URL}/api/dashboard/counters" -H "Authorization: Bearer ${DOCTOR_TOKEN}")
BEFORE_VITAUX=$(echo "$BEFORE_RESPONSE" | jq -r '.parametresVitauxAPrendre')
echo "OK : compteur avant relevé (parametresVitauxAPrendre=${BEFORE_VITAUX})."

PATIENT_PAYLOAD=$(cat <<'JSON'
{
  "firstName": "Rokhaya",
  "lastName": "Verify-Dashboard-Counters",
  "birthDate": "2022-11-03",
  "gender": "female",
  "guardian": {
    "name": "Assane Diagne",
    "relationship": "Père",
    "phone": "+221708887766"
  }
}
JSON
)

echo "Création d'un Patient fictif via POST /api/patients ..."
PATIENT_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PATIENT_PAYLOAD" | jq -r '.id // empty')

if [ -z "$PATIENT_ID" ]; then
  echo "ÉCHEC : aucune id retournée par POST /api/patients." >&2
  exit 1
fi
echo "OK : Patient créé avec l'id ${PATIENT_ID}."

# --- Consultation SANS vitaux : doit compter comme "vitaux à prendre" -------

NO_VITALS_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Consultation de suivi",
  "vitals": {}
}
JSON
)

echo "Création d'une consultation SANS vitaux via POST /api/patients/${PATIENT_ID}/encounters ..."
ENCOUNTER_NO_VITALS_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$NO_VITALS_PAYLOAD" | jq -r '.encounterId // empty')

if [ -z "$ENCOUNTER_NO_VITALS_ID" ]; then
  echo "ÉCHEC : aucun encounterId retourné pour la consultation sans vitaux." >&2
  exit 1
fi
echo "OK : consultation sans vitaux créée avec l'id ${ENCOUNTER_NO_VITALS_ID}."

echo "Vérification que le compteur a augmenté d'au moins 1 (avec quelques essais espacés) ..."
COUNTER_MAX_ATTEMPTS=10
COUNTER_RETRY_DELAY=2
attempt=0
AFTER_NO_VITALS=""
while [ "$attempt" -lt "$COUNTER_MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  RESPONSE=$(curl -sf "${BACKEND_URL}/api/dashboard/counters" -H "Authorization: Bearer ${DOCTOR_TOKEN}")
  AFTER_NO_VITALS=$(echo "$RESPONSE" | jq -r '.parametresVitauxAPrendre')
  if [ "$AFTER_NO_VITALS" -ge $((BEFORE_VITAUX + 1)) ]; then
    break
  fi
  sleep "$COUNTER_RETRY_DELAY"
done

if [ "$AFTER_NO_VITALS" -lt $((BEFORE_VITAUX + 1)) ]; then
  echo "ÉCHEC : le compteur n'a pas augmenté après la consultation sans vitaux (avant=${BEFORE_VITAUX}, après=${AFTER_NO_VITALS})." >&2
  exit 1
fi
echo "OK : le compteur a augmenté (avant=${BEFORE_VITAUX}, après=${AFTER_NO_VITALS}, tentative ${attempt}/${COUNTER_MAX_ATTEMPTS})."

# --- Consultation AVEC vitaux : ne doit PAS faire augmenter le compteur -----

WITH_VITALS_PAYLOAD=$(cat <<'JSON'
{
  "reason": "Consultation avec prise de constantes",
  "vitals": { "temperature": 37.4, "weight": 12.0 }
}
JSON
)

echo "Création d'une consultation AVEC vitaux via POST /api/patients/${PATIENT_ID}/encounters ..."
ENCOUNTER_WITH_VITALS_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$WITH_VITALS_PAYLOAD" | jq -r '.encounterId // empty')

if [ -z "$ENCOUNTER_WITH_VITALS_ID" ]; then
  echo "ÉCHEC : aucun encounterId retourné pour la consultation avec vitaux." >&2
  exit 1
fi
echo "OK : consultation avec vitaux créée avec l'id ${ENCOUNTER_WITH_VITALS_ID}."

echo "Laisse le temps à HAPI d'indexer avant de vérifier que le compteur n'a PAS augmenté davantage ..."
sleep "$COUNTER_RETRY_DELAY"
FINAL_RESPONSE=$(curl -sf "${BACKEND_URL}/api/dashboard/counters" -H "Authorization: Bearer ${DOCTOR_TOKEN}")
AFTER_WITH_VITALS=$(echo "$FINAL_RESPONSE" | jq -r '.parametresVitauxAPrendre')

if [ "$AFTER_WITH_VITALS" != "$AFTER_NO_VITALS" ]; then
  echo "ÉCHEC : le compteur a changé après une consultation AVEC vitaux (attendu ${AFTER_NO_VITALS}, reçu ${AFTER_WITH_VITALS}) — la consultation avec vitaux ne devrait pas être comptée." >&2
  exit 1
fi
echo "OK : le compteur n'a pas augmenté après la consultation avec vitaux (reste à ${AFTER_WITH_VITALS})."

# --- "Hospitalisés" signalé non disponible ----------------------------------

echo "Vérification que « hospitalisés » est signalé non disponible (pas de valeur inventée) ..."
DISPONIBLE=$(echo "$FINAL_RESPONSE" | jq -r '.hospitalises.disponible')
RAISON=$(echo "$FINAL_RESPONSE" | jq -r '.hospitalises.raison // empty')

if [ "$DISPONIBLE" != "false" ] || [ -z "$RAISON" ]; then
  echo "ÉCHEC : hospitalises devrait être { disponible: false, raison: <texte> }, reçu disponible=${DISPONIBLE} raison=\"${RAISON}\"." >&2
  exit 1
fi
echo "OK : hospitalisés signalé non disponible (raison : ${RAISON})."

# --- Contrôle d'accès ---------------------------------------------------------

echo "Vérification du contrôle d'accès : labo1 doit être bloqué (403) sur GET /api/dashboard/counters ..."
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/dashboard/counters" -H "Authorization: Bearer ${LAB_TOKEN}")

if [ "$FORBIDDEN_STATUS" != "403" ]; then
  echo "ÉCHEC : attendu 403 pour labo1, reçu ${FORBIDDEN_STATUS}." >&2
  exit 1
fi
echo "OK : labo1 est bien bloqué (403) sur /api/dashboard/counters."

echo ""
echo "Récapitulatif des ressources créées :"
echo "  Patient/${PATIENT_ID}"
echo "  Encounter/${ENCOUNTER_NO_VITALS_ID} (sans vitaux)"
echo "  Encounter/${ENCOUNTER_WITH_VITALS_ID} (avec vitaux)"
echo ""
echo "SUCCÈS : /api/dashboard/counters calcule un compteur réel de vitaux à prendre et signale honnêtement l'indicateur non disponible."
