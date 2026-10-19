#!/usr/bin/env bash
# Vérifie bout-en-bout, via le backend : registre de naissance, administration des médicaments
# pendant un séjour, décès à la sortie (patient marqué, arrivée refusée).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
BACKEND_URL="http://localhost:3001"

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ÉCHEC : '$bin' est requis." >&2; exit 1; }
done
curl -sf -o /dev/null "${BACKEND_URL}/api/health" || { echo "ÉCHEC : le backend ne répond pas sur ${BACKEND_URL}." >&2; exit 1; }

if [ -z "${SEED_USER_PASSWORD:-}" ] && [ -f apps/backend/.env ]; then
  SEED_USER_PASSWORD="$(grep -E '^SEED_USER_PASSWORD=' apps/backend/.env | tail -n1 | cut -d'=' -f2-)"
fi
[ -n "${SEED_USER_PASSWORD:-}" ] || { echo "ÉCHEC : SEED_USER_PASSWORD introuvable." >&2; exit 1; }

fail() { echo "ÉCHEC : $1" >&2; exit 1; }
login() {
  curl -s -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty'
}

DOCTOR=$(login medecin1); NURSE=$(login infirmiere1); LAB=$(login labo1)
[ -n "$DOCTOR" ] && [ -n "$NURSE" ] && [ -n "$LAB" ] || fail "login sans token."

api() { # api METHOD TOKEN PATH [BODY] -> écrit le corps, code HTTP sur la dernière ligne
  local method="$1" token="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "$body"
  else
    curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" -H "Authorization: Bearer ${token}"
  fi
}
status() { tail -n1 <<<"$1"; }
body() { sed '$d' <<<"$1"; }

PATIENT=$(body "$(api POST "$DOCTOR" /api/patients '{"firstName":"Bébé","lastName":"Verify-Naissance","birthDate":"2026-10-15","gender":"female","guardian":{"name":"Fatou Diop","relationship":"Mère","phone":"+221701112299"}}')" | jq -r '.id // empty')
[ -n "$PATIENT" ] || fail "création du patient."

# --- Naissance ---
[ "$(status "$(api POST "$LAB" "/api/patients/${PATIENT}/birth" '{"birthWeightG":2300}')")" = "403" ] || fail "le laboratoire ne devrait pas saisir une naissance (403)."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/birth" '{"birthWeightG":50}')")" = "400" ] || fail "poids absurde non refusé."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/birth" '{"birthWeightG":2300,"apgar1":6,"apgar5":8,"gestationalAgeWeeks":36,"deliveryMode":"caesarean"}')")" = "201" ] || fail "naissance refusée."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/birth" '{"birthWeightG":2300}')")" = "409" ] || fail "2e saisie non refusée (409)."
[ "$(status "$(api GET "$LAB" "/api/patients/${PATIENT}/birth")")" = "403" ] || fail "le laboratoire ne devrait pas lire (403)."
ALERTS=$(body "$(api GET "$NURSE" "/api/patients/${PATIENT}/birth")" | jq -c '.birth.alerts')
[ "$ALERTS" = '["low_birth_weight","preterm"]' ] || fail "alertes inattendues : $ALERTS"
echo "OK : registre de naissance (alertes $ALERTS)."

# --- Administration pendant un séjour ---
BED=$(body "$(api GET "$NURSE" /api/beds)" | jq -r '[.wards[].beds[] | select(.status=="U")][0].id // empty')
[ -n "$BED" ] || fail "aucun lit libre pour le test."
ENC=$(body "$(api POST "$DOCTOR" "/api/patients/${PATIENT}/encounters" '{"reason":"Détresse respiratoire","vitals":{"temperature":38.9,"weight":2.3}}')" | jq -r '.encounterId // empty')
RX=$(body "$(api POST "$DOCTOR" "/api/encounters/${ENC}/prescriptions" '{"medication":"Amoxicilline sirop","dosage":"selon poids","doseConfirmed":true}')" | jq -r '.prescriptionId // empty')
[ -n "$RX" ] || fail "prescription."
[ "$(status "$(api POST "$NURSE" /api/hospitalisations "{\"patientId\":\"${PATIENT}\",\"bedId\":\"${BED}\",\"reason\":\"Surveillance\"}")")" = "201" ] || fail "hospitalisation refusée."
STAY=$(body "$(api GET "$NURSE" "/api/patients/${PATIENT}/stays")" | jq -r '.stays[0].id // empty')
[ -n "$STAY" ] || fail "hospitalisation (lit $BED indisponible ?)."
[ "$(status "$(api POST "$DOCTOR" "/api/hospitalisations/${STAY}/administrations" "{\"prescriptionId\":\"${RX}\",\"given\":true}")")" = "403" ] || fail "le médecin ne devrait pas administrer (403)."
[ "$(status "$(api POST "$NURSE" "/api/hospitalisations/${STAY}/administrations" "{\"prescriptionId\":\"${RX}\",\"given\":false}")")" = "400" ] || fail "non donné sans motif non refusé."
[ "$(status "$(api POST "$NURSE" "/api/hospitalisations/${STAY}/administrations" "{\"prescriptionId\":\"${RX}\",\"given\":true}")")" = "201" ] || fail "administration refusée."
[ "$(status "$(api POST "$NURSE" "/api/hospitalisations/${STAY}/administrations" "{\"prescriptionId\":\"${RX}\",\"given\":true}")")" = "409" ] || fail "double enregistrement non refusé (409)."
COUNT=$(body "$(api GET "$DOCTOR" "/api/hospitalisations/${STAY}/administrations")" | jq '.administrations | length')
[ "$COUNT" = "1" ] || fail "1 administration attendue, trouvé $COUNT."
[ "$(status "$(api GET "$LAB" "/api/hospitalisations/${STAY}/administrations")")" = "403" ] || fail "le laboratoire ne devrait pas lire (403)."
echo "OK : administration des médicaments."

# --- Échéancier des doses ---
RX3=$(body "$(api POST "$DOCTOR" "/api/encounters/${ENC}/prescriptions" '{"medication":"Cotrimoxazole sirop","dosage":"3 prises par jour","doseMg":240,"dosesPerDay":3,"doseConfirmed":true}')" | jq -r '.prescriptionId // empty')
[ -n "$RX3" ] || fail "prescription à 3 prises par jour."
sleep 1
STATE=$(body "$(api GET "$NURSE" "/api/hospitalisations/${STAY}/administrations")" | jq -r --arg id "$RX3" '.schedule[] | select(.prescriptionId==$id) | .state')
[ "$STATE" = "awaiting_pharmacy" ] || fail "avant délivrance, état attendu awaiting_pharmacy : ${STATE:-absent}."
echo "OK : échéancier des doses."

# --- Décès à la sortie ---
[ "$(status "$(api POST "$NURSE" "/api/hospitalisations/${STAY}/discharge" '{"outcome":"deceased"}')")" = "403" ] || fail "l'infirmière ne devrait pas enregistrer un décès (403)."
[ "$(status "$(api POST "$DOCTOR" "/api/hospitalisations/${STAY}/discharge" '{"outcome":"deceased","deceasedAt":"2999-01-01T00:00:00Z"}')")" = "400" ] || fail "date de décès future non refusée."
[ "$(status "$(api POST "$DOCTOR" "/api/hospitalisations/${STAY}/discharge" '{"outcome":"deceased","summary":"Test de vérification"}')")" = "200" ] || fail "sortie refusée."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/arrival")")" = "409" ] || fail "arrivée d'un patient décédé non refusée (409)."
DECEASED=$(body "$(api GET "$DOCTOR" "/api/patients/${PATIENT}")" | jq -r '.patient.deceased // .deceased // empty')
[ "$(status "$(api POST "$DOCTOR" /api/hospitalisations "{\"patientId\":\"${PATIENT}\",\"bedId\":\"${BED}\"}")")" = "409" ] || fail "hospitalisation d'un patient décédé non refusée (409)."
[ "$(status "$(api POST "$DOCTOR" "/api/patients/${PATIENT}/encounters" '{"reason":"Test"}')")" = "409" ] || fail "consultation d'un patient décédé non refusée (409)."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/deceased/revoke" '{"reason":"Erreur de saisie"}')")" = "403" ] || fail "l'infirmière ne devrait pas corriger un décès (403)."
[ "$(status "$(api POST "$DOCTOR" "/api/patients/${PATIENT}/deceased/revoke" '{"reason":"x"}')")" = "400" ] || fail "motif trop court non refusé."
[ "$(status "$(api POST "$DOCTOR" "/api/patients/${PATIENT}/deceased/revoke" '{"reason":"Erreur de saisie de l issue"}')")" = "200" ] || fail "correction refusée."
[ "$(status "$(api POST "$DOCTOR" "/api/patients/${PATIENT}/deceased/revoke" '{"reason":"Erreur de saisie de l issue"}')")" = "409" ] || fail "2e correction non refusée (409)."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT}/arrival")")" = "201" ] || fail "après correction, l'arrivée devrait être acceptée."
echo "OK : garde-fous du décès et correction."
echo "OK : décès enregistré (champ deceased : ${DECEASED:-non exposé})."
echo "SUCCÈS : naissance, administration et décès vérifiés."
