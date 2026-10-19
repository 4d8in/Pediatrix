#!/usr/bin/env bash
# Vérifie le calendrier vaccinal, via le backend uniquement :
#   1. Un nourrisson sans vaccin a ses premières doses « en retard » ; le calendrier est refusé au technicien labo (403)
#   2. Après enregistrement du BCG (catalogue), la dose passe à « fait » avec sa date
#   3. Un vaccin hors catalogue est refusé (400) ; un vaccin en texte libre reste accepté

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
BACKEND_URL="http://localhost:3001"

for bin in curl jq date; do
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

NURSE=$(login infirmiere1); LAB=$(login labo1)
[ -n "$NURSE" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (infirmière, technicien)."

# Nourrisson né il y a 5 mois (donc BCG/VPO naissance et dose 1 à 6 semaines déjà échues depuis longtemps).
BIRTH=$(date -u -d "-150 day" +%F)
PATIENT_ID=$(body "$(api POST "$NURSE" /api/patients "{\"firstName\":\"Bineta\",\"lastName\":\"Verify-Vaccination\",\"birthDate\":\"${BIRTH}\",\"gender\":\"female\",\"guardian\":{\"name\":\"Coumba Faye\",\"relationship\":\"Mère\",\"phone\":\"+221701777000\"}}")" | jq -r '.id // empty')
[ -n "$PATIENT_ID" ] || fail "création du patient."

status_of() { body "$(api GET "$NURSE" "/api/patients/${PATIENT_ID}/vaccination-schedule")" | jq -r --arg v "$1" --argjson d "$2" '.schedule[] | select(.vaccine==$v and .dose==$d) | .status'; }

# --- 1. Calendrier d'un nourrisson non vacciné -------------------------------------------
[ "$(status_of BCG 1)" = "overdue" ] || fail "BCG dose 1 devrait être « en retard » (reçu '$(status_of BCG 1)')."
[ "$(status_of RR 1)" = "upcoming" ] || fail "RR dose 1 (9 mois) devrait être « à venir »."
[ "$(status "$(api GET "$LAB" "/api/patients/${PATIENT_ID}/vaccination-schedule")")" = "403" ] || fail "le technicien labo devrait être bloqué (403)."
echo "OK : nourrisson de 5 mois non vacciné -> BCG en retard, RR à venir ; technicien labo bloqué (403)."

# --- 2. Enregistrement du BCG ----------------------------------------------------------------
DAY=$(date -u -d "-3 day" +%F)
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT_ID}/immunizations" "{\"vaccine\":\"BCG (tuberculose)\",\"vaccineCode\":\"BCG\",\"date\":\"${DAY}\",\"doseNumber\":1}")")" = "201" ] || fail "enregistrement du BCG refusé."
DONE=""
for _ in $(seq 1 15); do
  DONE=$(body "$(api GET "$NURSE" "/api/patients/${PATIENT_ID}/vaccination-schedule")" | jq -r '.schedule[] | select(.vaccine=="BCG" and .dose==1 and .status=="done") | .doneDate')
  [ -n "$DONE" ] && break
  sleep 2
done
[ "$DONE" = "$DAY" ] || fail "BCG devrait être « fait » le ${DAY} (reçu '${DONE}')."
[ "$(status_of VPO 1)" = "overdue" ] || fail "le VPO naissance, non fait, devrait rester en retard."
echo "OK : BCG enregistré -> dose « faite » le ${DONE} ; VPO naissance toujours en retard."

# --- 3. Catalogue -------------------------------------------------------------------------------------
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT_ID}/immunizations" "{\"vaccine\":\"Inconnu\",\"vaccineCode\":\"ZZZ\",\"date\":\"${DAY}\"}")")" = "400" ] || fail "un vaccin hors catalogue devrait donner 400."
[ "$(status "$(api POST "$NURSE" "/api/patients/${PATIENT_ID}/immunizations" "{\"vaccine\":\"Vaccin local\",\"date\":\"${DAY}\"}")")" = "201" ] || fail "un vaccin en texte libre devrait rester accepté."
echo "OK : vaccin hors catalogue refusé (400), texte libre accepté."

echo "Terminé : calendrier vaccinal vérifié de bout en bout."
