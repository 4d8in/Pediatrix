#!/usr/bin/env bash
# Vérifie bout-en-bout la facturation, via le backend uniquement :
#   1. Contrôle d'accès : l'infirmière est bloquée (403) ; le médecin ne peut pas encaisser
#   2. Une consultation avec examen apparaît « à facturer » ; la facture contient consultation + examen
#   3. Une 2e facturation de la même consultation est refusée (409)
#   4. Un paiement partiel réduit le solde ; un paiement supérieur au solde est refusé ; le solde final solde la facture
#   5. Prise en charge par un assureur : le patient ne paie que sa part

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
ensure_account caissier1 cashier "Aïssatou Diop"
ensure_account pharmacien1 pharmacist "Moussa Fall"

DOCTOR=$(login medecin1); CASHIER=$(login caissier1); NURSE=$(login infirmiere1); LAB=$(login labo1)
[ -n "$DOCTOR" ] && [ -n "$CASHIER" ] && [ -n "$NURSE" ] && [ -n "$LAB" ] || fail "login sans token."
echo "OK : connecté (médecin, caissier, infirmière, technicien)."

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
[ "$(status "$(api GET "$NURSE" /api/billing/invoices)")" = "403" ] || fail "l'infirmière devrait être bloquée (403)."
[ "$(status "$(api GET "$DOCTOR" /api/billing/encounters)")" = "403" ] || fail "le médecin devrait être bloqué (403)."
echo "OK : infirmière et médecin bloqués sur la facturation."

new_encounter() { # crée patient + consultation + demande d'examen NFS ; écrit l'id de consultation
  local pid eid
  pid=$(body "$(api POST "$DOCTOR" /api/patients "{\"firstName\":\"$1\",\"lastName\":\"Verify-Billing\",\"birthDate\":\"2020-08-09\",\"gender\":\"female\",\"guardian\":{\"name\":\"Khady Ba\",\"relationship\":\"Mère\",\"phone\":\"+221701234000\"}}")" | jq -r '.id // empty')
  eid=$(body "$(api POST "$DOCTOR" "/api/patients/${pid}/encounters" '{"reason":"Contrôle","vitals":{"temperature":37.2,"weight":13.0}}')" | jq -r '.encounterId // empty')
  [ -n "$pid" ] && [ -n "$eid" ] || fail "création du patient ou de la consultation."
  body "$(api POST "$DOCTOR" "/api/encounters/${eid}/service-requests" '{"exam":"Numération formule sanguine (NFS)","requester":"Dr. Verify","examCode":"58410-2"}')" >/dev/null
  echo "$eid"
}

# --- 2. Facturation d'une consultation ------------------------------------------------
E1=$(new_encounter Awa)
FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(body "$(api GET "$CASHIER" /api/billing/encounters)" | jq -r --arg id "$E1" '.encounters[] | select(.encounterId==$id) | .patientName')
  [ -n "$FOUND" ] && break
  sleep 2
done
[ -n "$FOUND" ] || fail "la consultation n'apparaît pas « à facturer »."
RESP=$(api POST "$CASHIER" "/api/billing/encounters/${E1}/invoice" '{}')
[ "$(status "$RESP")" = "201" ] || fail "création de la facture ($(status "$RESP")): $(body "$RESP")"
INV=$(body "$RESP" | jq -r '.invoice.id'); TOTAL=$(body "$RESP" | jq -r '.invoice.total'); LINES=$(body "$RESP" | jq -r '.invoice.lines | length')
[ "$LINES" -eq 2 ] || fail "2 lignes attendues (consultation + examen), reçu ${LINES}."
echo "OK : facture ${INV} créée pour ${FOUND} (${LINES} lignes, total ${TOTAL})."

# --- 3. Pas de double facturation ------------------------------------------------------
[ "$(status "$(api POST "$CASHIER" "/api/billing/encounters/${E1}/invoice" '{}')")" = "409" ] || fail "une 2e facturation devrait donner 409."
echo "OK : double facturation refusée (409)."

# --- 4. Paiements -----------------------------------------------------------------------
[ "$(status "$(api POST "$CASHIER" "/api/billing/invoices/${INV}/payments" '{"amount":1000,"method":"cash"}')")" = "201" ] || fail "paiement partiel refusé."
BAL=$(body "$(api GET "$CASHIER" /api/billing/invoices)" | jq -r --arg id "$INV" '.invoices[] | select(.id==$id) | .balance')
[ "$BAL" -eq $((TOTAL - 1000)) ] || fail "solde attendu $((TOTAL - 1000)), obtenu ${BAL}."
[ "$(status "$(api POST "$CASHIER" "/api/billing/invoices/${INV}/payments" "{\"amount\":$((BAL + 1)),\"method\":\"cash\"}")")" = "409" ] || fail "un paiement supérieur au solde devrait donner 409."
RESP=$(api POST "$CASHIER" "/api/billing/invoices/${INV}/payments" "{\"amount\":${BAL},\"method\":\"mobile_money\"}")
[ "$(status "$RESP")" = "201" ] || fail "paiement du solde refusé."
[ "$(body "$RESP" | jq -r '.invoice.status')" = "balanced" ] || fail "la facture devrait être soldée."
echo "OK : paiement partiel (solde ${BAL}), excédent refusé, solde payé -> facture soldée."

# --- 5. Assureur ----------------------------------------------------------------------------
E2=$(new_encounter Fatou)
sleep 2
RESP=$(api POST "$CASHIER" "/api/billing/encounters/${E2}/invoice" '{"insurer":"IPM Verify","coveragePercent":80}')
[ "$(status "$RESP")" = "201" ] || fail "facture avec assureur refusée ($(status "$RESP")): $(body "$RESP")"
T2=$(body "$RESP" | jq -r '.invoice.total'); P2=$(body "$RESP" | jq -r '.invoice.patientShare')
[ "$P2" -eq $((T2 - T2 * 80 / 100)) ] || fail "part patient attendue $((T2 - T2 * 80 / 100)), obtenue ${P2}."
echo "OK : assureur à 80 % -> le patient ne doit que ${P2} sur ${T2}."

echo "Terminé : facturation vérifiée de bout en bout."
