#!/usr/bin/env bash
# Vérifie l'arrivée, le tri et la file active, via le backend uniquement :
#   1. Un patient admis entre dans la file (en attente) avec son heure d'arrivée
#   2. L'infirmière classe le patient en « urgence » : il passe en tête de file
#   3. Un patient déjà connu (créé sans arrivée) est ajouté à la file ; une 2e arrivée le même jour est refusée (409)
#   4. La consultation reprend l'arrivée du jour (même Encounter, heure d'arrivée conservée) et le patient passe en « consulté »
#   5. Contrôle d'accès : le technicien labo est bloqué (403) ; l'accueil peut enregistrer une arrivée mais pas trier (403)

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

NURSE=$(login infirmiere1); DOCTOR=$(login medecin1); RECEPTION=$(login accueil1); LAB=$(login labo1)
[ -n "$NURSE" ] && [ -n "$DOCTOR" ] && [ -n "$RECEPTION" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (infirmière, médecin, accueil, technicien)."

new_patient() { # $1 prénom, $2 jeton, $3 JSON additionnel
  body "$(api POST "$2" /api/patients "{\"firstName\":\"$1\",\"lastName\":\"Verify-Queue\",\"birthDate\":\"2021-04-04\",\"gender\":\"female\",\"guardian\":{\"name\":\"Sokhna Mbaye\",\"relationship\":\"Mère\",\"phone\":\"+221701888000\"}$3}")" | jq -r '.id // empty'
}
queue_entry() { # $1 patientId -> JSON de la ligne de file
  body "$(api GET "$NURSE" /api/queue)" | jq -c --arg id "$1" '.queue[] | select(.patientId==$id)'
}
wait_entry() { # $1 patientId ; attend que le patient apparaisse dans la file
  local entry=""
  for _ in $(seq 1 15); do
    entry=$(queue_entry "$1"); [ -n "$entry" ] && break; sleep 2
  done
  echo "$entry"
}

# --- 1. Admission -> file ------------------------------------------------------------
P1=$(new_patient Aminata "$NURSE" "")
P2=$(new_patient Babacar "$NURSE" "")
[ -n "$P1" ] && [ -n "$P2" ] || fail "création des patients."
E1=$(wait_entry "$P1")
[ -n "$E1" ] || fail "le patient admis n'apparaît pas dans la file."
[ "$(jq -r '.status' <<<"$E1")" = "en_attente" ] || fail "le patient admis devrait être « en attente »."
[ -n "$(jq -r '.admittedAt // empty' <<<"$E1")" ] || fail "l'heure d'arrivée est absente."
ARR1=$(jq -r '.encounterId' <<<"$E1")
echo "OK : patient admis -> file « en attente » (arrivée ${ARR1})."

# --- 2. Tri ------------------------------------------------------------------------------------
wait_entry "$P2" >/dev/null
[ "$(status "$(api POST "$NURSE" "/api/patients/${P2}/triage" '{"category":"emergency","note":"Détresse respiratoire"}')")" = "201" ] || fail "tri refusé."
[ "$(status "$(api POST "$NURSE" "/api/patients/${P2}/triage" '{"category":"inconnu"}')")" = "400" ] || fail "une catégorie de tri invalide devrait donner 400."
TRI=""
for _ in $(seq 1 15); do
  TRI=$(queue_entry "$P2" | jq -r '.triage // empty'); [ "$TRI" = "emergency" ] && break; sleep 2
done
[ "$TRI" = "emergency" ] || fail "le tri « urgence » n'apparaît pas dans la file."
FIRST=$(body "$(api GET "$NURSE" /api/queue)" | jq -r '[.queue[] | select(.status=="en_attente")][0].triage')
[ "$FIRST" = "emergency" ] || fail "l'urgence devrait être en tête de la file (reçu '${FIRST}')."
echo "OK : triage « urgence » enregistré, patient en tête de file."

# --- 3. Patient déjà connu ---------------------------------------------------------------------------
P3=$(new_patient Cheikhou "$NURSE" ',"checkIn":false')
sleep 2
R=$(api POST "$RECEPTION" "/api/patients/${P3}/arrival" '{}')
[ "$(status "$R")" = "201" ] || fail "enregistrement de l'arrivée refusé ($(status "$R")): $(body "$R")"
E3=$(wait_entry "$P3"); [ -n "$E3" ] || fail "le patient déjà connu n'apparaît pas dans la file."
[ "$(status "$(api POST "$RECEPTION" "/api/patients/${P3}/arrival" '{}')")" = "409" ] || fail "une 2e arrivée le même jour devrait donner 409."
echo "OK : patient déjà connu ajouté à la file, 2e arrivée refusée (409)."

# --- 4. La consultation reprend l'arrivée --------------------------------------------------------------------
ENC=$(body "$(api POST "$DOCTOR" "/api/patients/${P1}/encounters" '{"reason":"Fièvre","vitals":{"temperature":38.4,"weight":12.0}}')" | jq -r '.encounterId // empty')
[ "$ENC" = "$ARR1" ] || fail "la consultation devrait reprendre l'arrivée ${ARR1} (reçu '${ENC}')."
DONE=""
for _ in $(seq 1 15); do
  DONE=$(queue_entry "$P1" | jq -r '.status'); [ "$DONE" = "consulte" ] && break; sleep 2
done
[ "$DONE" = "consulte" ] || fail "le patient consulté devrait passer à « consulté »."
[ "$(queue_entry "$P1" | jq -r '.admittedAt')" = "$(jq -r '.admittedAt' <<<"$E1")" ] || fail "l'heure d'arrivée aurait dû être conservée."
echo "OK : consultation sur l'arrivée existante (Encounter ${ENC}), heure d'arrivée conservée, statut « consulté »."

# --- 5. Contrôle d'accès --------------------------------------------------------------------------------------
[ "$(status "$(api GET "$LAB" /api/queue)")" = "403" ] || fail "le technicien labo devrait être bloqué (403)."
[ "$(status "$(api POST "$RECEPTION" "/api/patients/${P3}/triage" '{"category":"priority"}')")" = "403" ] || fail "l'accueil ne devrait pas trier (403)."
echo "OK : technicien labo bloqué, accueil sans droit de tri."

echo "Terminé : arrivée, tri et file active vérifiés de bout en bout."
