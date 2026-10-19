#!/usr/bin/env bash
# Vérifie le dossier clinique enrichi, via le backend uniquement :
#   1. Un patient créé reçoit un numéro de dossier PX-… ; la recherche par ce numéro le retrouve
#   2. Un diagnostic CIM-10 du catalogue est enregistré sur la consultation et relu dans le dossier (médecin)
#   3. Un code absent du catalogue est refusé (400) ; un diagnostic libre est accepté
#   4. Contrôle d'accès : l'infirmière lit les diagnostics mais ne peut pas en poser (403) ; le technicien labo est bloqué en lecture (403)

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
api() {
  local method="$1" token="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d "$body"
  else
    curl -s -w '\n%{http_code}' -X "$method" "${BACKEND_URL}${path}" -H "Authorization: Bearer ${token}"
  fi
}
status() { tail -n1 <<<"$1"; }
body() { sed '$d' <<<"$1"; }

DOCTOR=$(login medecin1); NURSE=$(login infirmiere1); LAB=$(login labo1)
[ -n "$DOCTOR" ] && [ -n "$NURSE" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (médecin, infirmière, technicien)."

# --- 1. Numéro de dossier -----------------------------------------------------------
RESP=$(body "$(api POST "$DOCTOR" /api/patients '{"firstName":"Oumar","lastName":"Verify-Clinical","birthDate":"2022-02-02","gender":"male","guardian":{"name":"Ndeye Sarr","relationship":"Mère","phone":"+221701999000"}}')")
PATIENT_ID=$(jq -r '.id // empty' <<<"$RESP"); MRN=$(jq -r '.mrn // empty' <<<"$RESP")
[ -n "$PATIENT_ID" ] || fail "création du patient."
[[ "$MRN" =~ ^PX-[0-9]{6,}$ ]] || fail "numéro de dossier inattendu : '${MRN}'."
FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(body "$(api GET "$DOCTOR" "/api/patients?search=${MRN}")" | jq -r --arg id "$PATIENT_ID" '.patients[] | select(.id==$id) | .mrn')
  [ -n "$FOUND" ] && break
  sleep 2
done
[ "$FOUND" = "$MRN" ] || fail "la recherche par numéro ${MRN} ne retrouve pas le patient."
echo "OK : patient ${PATIENT_ID} -> dossier ${MRN}, retrouvé par son numéro."

# --- 2. Diagnostic codé -----------------------------------------------------------------
ENCOUNTER_ID=$(body "$(api POST "$DOCTOR" "/api/patients/${PATIENT_ID}/encounters" '{"reason":"Toux et fièvre","vitals":{"temperature":38.7,"weight":12.4}}')" | jq -r '.encounterId // empty')
[ -n "$ENCOUNTER_ID" ] || fail "création de la consultation."
[ "$(status "$(api POST "$DOCTOR" "/api/encounters/${ENCOUNTER_ID}/diagnoses" '{"code":"J18.9","certainty":"provisional"}')")" = "201" ] || fail "diagnostic codé refusé."

SEEN=""
for _ in $(seq 1 15); do
  SEEN=$(body "$(api GET "$DOCTOR" "/api/patients/${PATIENT_ID}/diagnoses")" | jq -r '.diagnoses[] | select(.code=="J18.9" and .certainty=="provisional") | .recorder')
  [ -n "$SEEN" ] && break
  sleep 2
done
[ -n "$SEEN" ] || fail "le diagnostic J18.9 n'apparaît pas dans le dossier."
echo "OK : diagnostic J18.9 (provisoire) relu dans le dossier, posé par ${SEEN}."

# --- 3. Catalogue ------------------------------------------------------------------------
[ "$(status "$(api POST "$DOCTOR" "/api/encounters/${ENCOUNTER_ID}/diagnoses" '{"code":"Z99.99","certainty":"confirmed"}')")" = "400" ] || fail "un code inconnu devrait donner 400."
[ "$(status "$(api POST "$DOCTOR" "/api/encounters/${ENCOUNTER_ID}/diagnoses" '{"text":"Éruption cutanée à préciser","certainty":"confirmed"}')")" = "201" ] || fail "un diagnostic libre devrait être accepté."
echo "OK : code inconnu refusé (400), diagnostic libre accepté."

# --- 4. Contrôle d'accès -------------------------------------------------------------------------
[ "$(status "$(api GET "$NURSE" "/api/patients/${PATIENT_ID}/diagnoses")")" = "200" ] || fail "l'infirmière devrait lire les diagnostics."
[ "$(status "$(api POST "$NURSE" "/api/encounters/${ENCOUNTER_ID}/diagnoses" '{"code":"J18.9"}')")" = "403" ] || fail "l'infirmière ne devrait pas poser de diagnostic (403)."
[ "$(status "$(api GET "$LAB" "/api/patients/${PATIENT_ID}/diagnoses")")" = "403" ] || fail "le technicien labo ne devrait pas lire les diagnostics (403)."
echo "OK : infirmière en lecture seule, technicien labo bloqué."

echo "Terminé : dossier clinique vérifié de bout en bout."
