#!/usr/bin/env bash
# Vérifie la référence vers une autre structure et le dépistage nutritionnel (PB), via le backend :
#   1. Le médecin enregistre une référence urgente ; elle est relue dans le dossier (infirmière en lecture)
#   2. L'infirmière ne peut pas créer de référence (403) ; le technicien labo ne peut pas les lire (403)
#   3. Une référence incomplète est refusée (400) ; elle n'apparaît pas dans la file du laboratoire
#   4. Périmètre brachial : 110 mm chez un enfant de 18 mois -> malnutrition sévère ; 118 -> modérée ; 135 -> normal
#   5. Chez un enfant de moins de 6 mois, le PB est enregistré sans classement ; une valeur absurde est refusée (400)

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

DOCTOR=$(login medecin1); NURSE=$(login infirmiere1); LAB=$(login labo1)
[ -n "$DOCTOR" ] && [ -n "$NURSE" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (médecin, infirmière, technicien)."

new_patient() { # $1 prénom, $2 date de naissance
  body "$(api POST "$DOCTOR" /api/patients "{\"firstName\":\"$1\",\"lastName\":\"Verify-Referral\",\"birthDate\":\"$2\",\"gender\":\"male\",\"guardian\":{\"name\":\"Awa Kane\",\"relationship\":\"Mère\",\"phone\":\"+221701666000\"}}")" | jq -r '.id // empty'
}

# --- 1-3. Référence --------------------------------------------------------------------
P1=$(new_patient Moussa "$(date -u -d '-30 month' +%F)")
[ -n "$P1" ] || fail "création du patient."
ENC=$(body "$(api POST "$DOCTOR" "/api/patients/${P1}/encounters" '{"reason":"Détresse respiratoire","vitals":{"temperature":39.0,"weight":12.0}}')" | jq -r '.encounterId // empty')
[ -n "$ENC" ] || fail "création de la consultation."

[ "$(status "$(api POST "$NURSE" "/api/encounters/${ENC}/referral" '{"destination":"CHU","reason":"x"}')")" = "403" ] || fail "l'infirmière ne devrait pas créer de référence (403)."
[ "$(status "$(api POST "$DOCTOR" "/api/encounters/${ENC}/referral" '{"destination":"CHU"}')")" = "400" ] || fail "une référence sans motif devrait donner 400."
[ "$(status "$(api POST "$DOCTOR" "/api/encounters/${ENC}/referral" '{"destination":"CHU Aristide Le Dantec","reason":"Détresse respiratoire","summary":"Tirage sous-costal, amoxicilline débutée","urgent":true}')")" = "201" ] || fail "création de la référence refusée."

SEEN=""
for _ in $(seq 1 15); do
  SEEN=$(body "$(api GET "$NURSE" "/api/patients/${P1}/referrals")" | jq -r '.referrals[] | select(.destination=="CHU Aristide Le Dantec" and .urgent==true) | .sender')
  [ -n "$SEEN" ] && break
  sleep 2
done
[ -n "$SEEN" ] || fail "la référence n'apparaît pas dans le dossier."
[ "$(status "$(api GET "$LAB" "/api/patients/${P1}/referrals")")" = "403" ] || fail "le technicien labo ne devrait pas lire les références (403)."
LABQ=$(body "$(api GET "$LAB" /api/lab/requests)" | jq -r --arg p "$P1" '[.requests[] | select(.patientId==$p)] | length')
[ "$LABQ" = "0" ] || fail "la référence ne doit pas apparaître dans la file du laboratoire."
echo "OK : référence urgente enregistrée par ${SEEN}, lue par l'infirmière ; médecin seul à créer, labo bloqué, file labo intacte."

# --- 4-5. Périmètre brachial -----------------------------------------------------------------
P2=$(new_patient Fatima "$(date -u -d '-18 month' +%F)")
P3=$(new_patient Bébé "$(date -u -d '-3 month' +%F)")
[ -n "$P2" ] && [ -n "$P3" ] || fail "création des patients."
TODAY=$(date -u +%F); D2=$(date -u -d '-1 day' +%F); D3=$(date -u -d '-2 day' +%F)
for pair in "$TODAY:110" "$D2:118" "$D3:135"; do
  [ "$(status "$(api POST "$NURSE" "/api/patients/${P2}/growth" "{\"date\":\"${pair%%:*}\",\"muac\":${pair##*:}}")")" = "201" ] || fail "enregistrement du PB ${pair##*:} refusé."
done
status_of() { body "$(api GET "$NURSE" "/api/patients/$1/growth")" | jq -r --argjson v "$2" '.measurements[] | select(.muac==$v) | .muacStatus // "aucun"'; }
STATUSES=""
for _ in $(seq 1 15); do
  STATUSES="$(status_of "$P2" 110)/$(status_of "$P2" 118)/$(status_of "$P2" 135)"
  [ "$STATUSES" = "severe/moderate/normal" ] && break
  sleep 2
done
[ "$STATUSES" = "severe/moderate/normal" ] || fail "classement attendu severe/moderate/normal, reçu '${STATUSES}'."
echo "OK : enfant de 18 mois : PB 110 mm -> sévère, 118 -> modérée, 135 -> normal."

[ "$(status "$(api POST "$NURSE" "/api/patients/${P3}/growth" "{\"date\":\"${TODAY}\",\"muac\":110}")")" = "201" ] || fail "PB d'un nourrisson refusé."
INFANT=""
for _ in $(seq 1 15); do
  INFANT=$(status_of "$P3" 110); [ -n "$INFANT" ] && break; sleep 2
done
[ "$INFANT" = "aucun" ] || fail "un enfant de 3 mois ne doit pas être classé (reçu '${INFANT}')."
[ "$(status "$(api POST "$NURSE" "/api/patients/${P3}/growth" "{\"date\":\"${TODAY}\",\"muac\":9999}")")" = "400" ] || fail "un PB absurde devrait donner 400."
echo "OK : nourrisson de 3 mois : PB enregistré sans classement ; valeur absurde refusée (400)."

echo "Terminé : référence et dépistage nutritionnel vérifiés de bout en bout."
