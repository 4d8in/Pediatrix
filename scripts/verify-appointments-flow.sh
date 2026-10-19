#!/usr/bin/env bash
# Vérifie bout-en-bout les rendez-vous, via le backend uniquement :
#   1. Contrôle d'accès : le technicien labo est bloqué (403) ; le médecin ne peut pas prendre de rendez-vous
#   2. L'accueil prend un rendez-vous dans un créneau libre ; le créneau disparaît des créneaux libres
#   3. Le même créneau ne peut pas être réservé deux fois (409)
#   4. Le médecin voit le rendez-vous dans son agenda ; l'accueil enregistre l'arrivée, le médecin le clôt
#   5. Un rendez-vous clos ne peut plus être annulé (409)

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
ensure_account() {
  local username="$1" role="$2" name="$3"
  [ -n "$(login "$username")" ] && return 0
  local admin; admin=$(login admin1)
  [ -n "$admin" ] || fail "compte $username absent et admin1 injoignable (seed-users ?)."
  curl -sf -X POST "${BACKEND_URL}/api/users" -H "Authorization: Bearer ${admin}" -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"displayName\":\"${name}\",\"role\":\"${role}\",\"password\":\"${SEED_USER_PASSWORD}\"}" >/dev/null \
    || fail "création du compte $username."
}
ensure_account accueil1 receptionist "Mariama Sy"

RECEPTION=$(login accueil1); DOCTOR=$(login medecin1); LAB=$(login labo1)
[ -n "$RECEPTION" ] && [ -n "$DOCTOR" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (accueil, médecin, technicien)."

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

# --- 1. Contrôle d'accès -------------------------------------------------------
[ "$(status "$(api GET "$LAB" /api/appointments)")" = "403" ] || fail "le technicien labo devrait être bloqué (403)."
[ "$(status "$(api POST "$DOCTOR" /api/appointments '{"patientId":"1","practitionerId":"1","start":"2030-01-01T09:00:00Z","reason":"x"}')")" = "403" ] || fail "le médecin ne devrait pas prendre de rendez-vous (403)."
echo "OK : technicien et médecin bloqués sur la prise de rendez-vous."

# --- 2. Prise de rendez-vous ---------------------------------------------------------
DOC_ID=$(body "$(api GET "$RECEPTION" /api/appointments/doctors)" | jq -r --arg n "Dr. Awa Diallo" '[.doctors[] | select(.name==$n)][0].practitionerId // .doctors[0].practitionerId')
[ -n "$DOC_ID" ] && [ "$DOC_ID" != "null" ] || fail "aucun médecin disponible."
# Le médecin connecté doit être celui qui reçoit le rendez-vous pour tester son agenda.
MY_ID=$(curl -s -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"medecin1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.user.id')
DOC_ID="$MY_ID"

PATIENT_ID=$(body "$(api POST "$RECEPTION" /api/patients '{"firstName":"Mamadou","lastName":"Verify-Appointments","birthDate":"2019-02-11","gender":"male","guardian":{"name":"Rokhaya Fall","relationship":"Mère","phone":"+221701230000"}}')" | jq -r '.id // empty')
[ -n "$PATIENT_ID" ] || fail "l'accueil devrait pouvoir créer un patient."

# Premier jour libre dans les 30 prochains jours (on évite les créneaux déjà pris par un test précédent).
SLOT=""; DAY=""
for offset in $(seq 1 30); do
  DAY=$(date -u -d "+${offset} day" +%F)
  SLOT=$(body "$(api GET "$RECEPTION" "/api/appointments/slots?date=${DAY}&practitionerId=${DOC_ID}")" | jq -r '.slots[0] // empty')
  [ -n "$SLOT" ] && break
done
[ -n "$SLOT" ] || fail "aucun créneau libre trouvé."

RESP=$(api POST "$RECEPTION" /api/appointments "{\"patientId\":\"${PATIENT_ID}\",\"practitionerId\":\"${DOC_ID}\",\"start\":\"${SLOT}\",\"reason\":\"Contrôle\"}")
[ "$(status "$RESP")" = "201" ] || fail "prise de rendez-vous refusée ($(status "$RESP")): $(body "$RESP")"
APPT=$(body "$RESP" | jq -r '.appointment.id')
STILL=$(body "$(api GET "$RECEPTION" "/api/appointments/slots?date=${DAY}&practitionerId=${DOC_ID}")" | jq -r --arg s "$SLOT" '[.slots[] | select(.==$s)] | length')
[ "$STILL" = "0" ] || fail "le créneau réservé devrait disparaître des créneaux libres."
echo "OK : rendez-vous ${APPT} pris le ${SLOT}, créneau retiré des créneaux libres."

# --- 3. Pas de double réservation ------------------------------------------------------------
[ "$(status "$(api POST "$RECEPTION" /api/appointments "{\"patientId\":\"${PATIENT_ID}\",\"practitionerId\":\"${DOC_ID}\",\"start\":\"${SLOT}\",\"reason\":\"Autre\"}")")" = "409" ] || fail "une double réservation devrait donner 409."
echo "OK : double réservation refusée (409)."

# --- 4. Agenda du médecin, arrivée, clôture ------------------------------------------------------
FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(body "$(api GET "$DOCTOR" "/api/appointments?date=${DAY}")" | jq -r --arg id "$APPT" '.appointments[] | select(.id==$id) | .patientName')
  [ -n "$FOUND" ] && break
  sleep 2
done
[ -n "$FOUND" ] || fail "le rendez-vous n'apparaît pas dans l'agenda du médecin."
[ "$(status "$(api POST "$DOCTOR" "/api/appointments/${APPT}/status" '{"status":"arrived"}')")" = "403" ] || fail "le médecin ne devrait pas enregistrer l'arrivée (403)."
[ "$(status "$(api POST "$RECEPTION" "/api/appointments/${APPT}/status" '{"status":"fulfilled"}')")" = "403" ] || fail "l'accueil ne devrait pas clore le rendez-vous (403)."
[ "$(status "$(api POST "$RECEPTION" "/api/appointments/${APPT}/status" '{"status":"arrived"}')")" = "200" ] || fail "enregistrement de l'arrivée refusé."
[ "$(status "$(api POST "$DOCTOR" "/api/appointments/${APPT}/status" '{"status":"fulfilled"}')")" = "200" ] || fail "clôture par le médecin refusée."
echo "OK : agenda du médecin, arrivée (accueil) puis clôture (médecin)."

# --- 5. Rendez-vous clos -------------------------------------------------------------------------------
[ "$(status "$(api POST "$RECEPTION" "/api/appointments/${APPT}/status" '{"status":"cancelled"}')")" = "409" ] || fail "annuler un rendez-vous clos devrait donner 409."
echo "OK : un rendez-vous clos ne peut plus être annulé (409)."

echo "Terminé : rendez-vous vérifiés de bout en bout."
