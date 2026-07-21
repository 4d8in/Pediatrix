#!/usr/bin/env bash
# Prouve que la barrière de contrôle d'accès est appliquée côté backend, token
# en main, pour chacun des 5 rôles :
#   1. Login réussi -> token JWT
#   2. Un appel AUTORISÉ pour ce rôle -> 2xx
#   3. Un appel INTERDIT pour ce rôle -> 403
#   4. Un appel SANS token -> 401
#
# Nécessite que le backend tourne et que scripts/seed-users.sh ait été exécuté
# (comptes de test + SEED_USER_PASSWORD).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_URL="http://localhost:3001"
MAX_ATTEMPTS=30
FAILED=0

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ÉCHEC : '$bin' est requis mais introuvable dans le PATH." >&2
    exit 1
  fi
done

if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  ENV_FILE="apps/backend/.env"
  if [ -f "$ENV_FILE" ]; then
    SEED_USER_PASSWORD="$(grep -E '^SEED_USER_PASSWORD=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2-)"
  fi
fi
if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  echo "ÉCHEC : SEED_USER_PASSWORD introuvable (ni en variable d'env, ni dans apps/backend/.env)." >&2
  exit 1
fi

# --- Attente du backend ------------------------------------------------------

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
echo ""

# --- Assertions --------------------------------------------------------------

# Écrit sur stderr : certains appels (voir login(), plus bas) sont utilisés dans
# une substitution de commande ($(...)) qui ne capture que stdout, pour pouvoir
# à la fois logger le résultat et renvoyer le token.
check() {
  local description="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  OK    ${description} — attendu=${expected} obtenu=${actual}" >&2
  else
    echo "  ÉCHEC ${description} — attendu=${expected} obtenu=${actual}" >&2
    FAILED=1
  fi
}

# Effectue une requête et remplit REQ_BODY / REQ_CODE.
req() {
  local method="$1" path="$2" token="${3:-}" data="${4:-}"
  local response
  if [ -n "$token" ]; then
    if [ -n "$data" ]; then
      response=$(curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" \
        -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "$data")
    else
      response=$(curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" \
        -H "Authorization: Bearer ${token}")
    fi
  else
    if [ -n "$data" ]; then
      response=$(curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" \
        -H "Content-Type: application/json" -d "$data")
    else
      response=$(curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}")
    fi
  fi
  REQ_BODY=$(echo "$response" | sed '$d')
  REQ_CODE=$(echo "$response" | tail -n1)
}

login() {
  local username="$1"
  req POST "/api/auth/login" "" "{\"username\":\"${username}\",\"password\":\"${SEED_USER_PASSWORD}\"}"
  check "login ${username}" "200" "$REQ_CODE"
  echo "$REQ_BODY" | jq -r '.token // empty'
}

# --- 1. Login pour les 5 rôles ------------------------------------------------

echo "--- Login ---"
TOKEN_NURSE=$(login infirmiere1)
TOKEN_DOCTOR=$(login medecin1)
TOKEN_LAB=$(login labo1)
TOKEN_DIRECTOR=$(login directeur1)
TOKEN_ADMIN=$(login admin1)
echo ""

if [ -z "$TOKEN_NURSE" ] || [ -z "$TOKEN_DOCTOR" ] || [ -z "$TOKEN_LAB" ] || [ -z "$TOKEN_DIRECTOR" ] || [ -z "$TOKEN_ADMIN" ]; then
  echo "ÉCHEC : au moins un login n'a pas renvoyé de token. Avez-vous lancé scripts/seed-users.sh ?" >&2
  exit 1
fi

# --- 2. Mise en place de données de test (via les rôles normalement autorisés) --

echo "--- Mise en place (patient / consultation / demande d'examen) ---"
req POST "/api/patients" "$TOKEN_NURSE" '{
  "firstName": "Aïcha",
  "lastName": "Verify-Auth",
  "birthDate": "2020-03-14",
  "gender": "female",
  "guardian": { "name": "Moussa Kane", "relationship": "Père", "phone": "+221701112233" }
}'
PATIENT_ID=$(echo "$REQ_BODY" | jq -r '.id // empty')
check "POST /api/patients (infirmière, autorisé)" "201" "$REQ_CODE"

req POST "/api/patients/${PATIENT_ID}/encounters" "$TOKEN_DOCTOR" '{
  "reason": "Contrôle de routine",
  "vitals": { "temperature": 37.1, "weight": 12.4 }
}'
ENCOUNTER_ID=$(echo "$REQ_BODY" | jq -r '.encounterId // empty')
check "POST /api/patients/:id/encounters (médecin, autorisé)" "201" "$REQ_CODE"

req POST "/api/encounters/${ENCOUNTER_ID}/service-requests" "$TOKEN_DOCTOR" '{
  "exam": "NFS",
  "requester": "Dr. Verify-Auth"
}'
SERVICE_REQUEST_ID=$(echo "$REQ_BODY" | jq -r '.serviceRequestId // empty')
check "POST /api/encounters/:id/service-requests (médecin, autorisé)" "201" "$REQ_CODE"

if [ -z "$PATIENT_ID" ] || [ -z "$ENCOUNTER_ID" ] || [ -z "$SERVICE_REQUEST_ID" ]; then
  echo "ÉCHEC : la mise en place des données de test a échoué, impossible de continuer." >&2
  exit 1
fi
echo ""

# --- 3. Appels autorisés (un par rôle, au-delà de la mise en place ci-dessus) --

echo "--- Appels autorisés ---"
req GET "/api/lab/requests" "$TOKEN_LAB"
check "GET /api/lab/requests (technicien labo, autorisé)" "200" "$REQ_CODE"

req POST "/api/lab/requests/${SERVICE_REQUEST_ID}/report" "$TOKEN_LAB" '{
  "results": [{ "label": "NFS", "value": "Normale" }],
  "conclusion": "RAS"
}'
check "POST /api/lab/requests/:id/report (technicien labo, autorisé)" "201" "$REQ_CODE"

req GET "/api/patients/${PATIENT_ID}" "$TOKEN_DIRECTOR"
check "GET /api/patients/:id (directeur, autorisé)" "200" "$REQ_CODE"

req GET "/api/fhir-log" "$TOKEN_ADMIN"
check "GET /api/fhir-log (admin technique, autorisé)" "200" "$REQ_CODE"
echo ""

# --- 4. Appels interdits (un par rôle) ----------------------------------------

echo "--- Appels interdits (403 attendu) ---"
req POST "/api/patients/${PATIENT_ID}/encounters" "$TOKEN_LAB" '{"reason":"x","vitals":{"weight":1}}'
check "POST /api/patients/:id/encounters (technicien labo, interdit)" "403" "$REQ_CODE"

req POST "/api/encounters/${ENCOUNTER_ID}/service-requests" "$TOKEN_NURSE" '{"exam":"x","requester":"x"}'
check "POST /api/encounters/:id/service-requests (infirmière, interdit)" "403" "$REQ_CODE"

req GET "/api/lab/requests" "$TOKEN_DOCTOR"
check "GET /api/lab/requests (médecin, interdit)" "403" "$REQ_CODE"

req POST "/api/patients" "$TOKEN_DIRECTOR" '{}'
check "POST /api/patients (directeur, interdit)" "403" "$REQ_CODE"

req GET "/api/fhir-log" "$TOKEN_NURSE"
check "GET /api/fhir-log (infirmière, interdit)" "403" "$REQ_CODE"

req GET "/api/patients" "$TOKEN_ADMIN"
check "GET /api/patients (admin technique, interdit)" "403" "$REQ_CODE"
echo ""

# --- 5. Appels sans token (401 attendu) ---------------------------------------

echo "--- Appels sans token (401 attendu) ---"
req GET "/api/fhir-log" ""
check "GET /api/fhir-log (sans token)" "401" "$REQ_CODE"

req POST "/api/patients" "" '{}'
check "POST /api/patients (sans token)" "401" "$REQ_CODE"

req GET "/api/lab/requests" ""
check "GET /api/lab/requests (sans token)" "401" "$REQ_CODE"
echo ""

# --- Bilan ---------------------------------------------------------------------

if [ "$FAILED" -eq 0 ]; then
  echo "SUCCÈS : tous les cas attendus correspondent — la barrière de contrôle d'accès fonctionne."
  exit 0
else
  echo "ÉCHEC : au moins un cas ne correspond pas à ce qui était attendu (voir ÉCHEC ci-dessus)." >&2
  exit 1
fi
