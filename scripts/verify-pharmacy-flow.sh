#!/usr/bin/env bash
# Vérifie bout-en-bout la pharmacie, via le backend uniquement :
#   1. Contrôle d'accès : l'infirmière est bloquée (403) sur le stock ; le médecin ne peut pas réceptionner
#   2. Une réception augmente le stock
#   3. Une ordonnance du médecin apparaît à délivrer ; la délivrance baisse le stock et clôt l'ordonnance
#   4. Une 2e délivrance de la même ordonnance (409) et une quantité > stock (409) sont refusées

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
# Crée le compte s'il n'existe pas encore (installation antérieure à ce module) : ne touche pas aux autres comptes.
ensure_account() {
  local username="$1" role="$2" name="$3"
  [ -n "$(login "$username")" ] && return 0
  local admin; admin=$(login admin1)
  [ -n "$admin" ] || fail "compte $username absent et admin1 injoignable (seed-users ?)."
  curl -sf -X POST "${BACKEND_URL}/api/users" -H "Authorization: Bearer ${admin}" -H "Content-Type: application/json" \
    -d "{\"username\":\"${username}\",\"displayName\":\"${name}\",\"role\":\"${role}\",\"password\":\"${SEED_USER_PASSWORD}\"}" >/dev/null \
    || fail "création du compte $username."
}
ensure_account pharmacien1 pharmacist "Moussa Fall"

DOCTOR=$(login medecin1); PHARM=$(login pharmacien1); NURSE=$(login infirmiere1)
[ -n "$DOCTOR" ] && [ -n "$PHARM" ] && [ -n "$NURSE" ] || fail "login sans token."
echo "OK : connecté (médecin, pharmacien, infirmière)."

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
stock_of() { body "$(api GET "$PHARM" /api/pharmacy/stock)" | jq -r --arg c "$1" '.items[] | select(.code==$c) | .quantity'; }

# --- 1. Contrôle d'accès -----------------------------------------------------
[ "$(status "$(api GET "$NURSE" /api/pharmacy/stock)")" = "403" ] || fail "l'infirmière devrait être bloquée sur le stock (403)."
[ "$(status "$(api GET "$DOCTOR" /api/pharmacy/formulary)")" = "200" ] || fail "le médecin devrait lire le formulaire."
[ "$(status "$(api POST "$DOCTOR" /api/pharmacy/stock/receipts '{"itemCode":"PARA-SIR","quantity":5}')")" = "403" ] || fail "le médecin ne devrait pas réceptionner (403)."
echo "OK : infirmière bloquée sur le stock, médecin bloqué sur la réception."

# --- 2. Réception -------------------------------------------------------------
BEFORE=$(stock_of PARA-SIR)
[ "$(status "$(api POST "$PHARM" /api/pharmacy/stock/receipts '{"itemCode":"PARA-SIR","quantity":20,"lot":"VERIFY-1","expiry":"2028-12-31"}')")" = "201" ] || fail "réception refusée."
AFTER=$(stock_of PARA-SIR)
[ "$AFTER" -eq $((BEFORE + 20)) ] || fail "stock attendu $((BEFORE + 20)), obtenu $AFTER."
echo "OK : réception de 20 flacons (stock ${BEFORE} -> ${AFTER})."

# --- 3. Ordonnance puis délivrance ------------------------------------------------
PATIENT_ID=$(body "$(api POST "$DOCTOR" /api/patients '{"firstName":"Ibrahima","lastName":"Verify-Pharmacy","birthDate":"2021-05-20","gender":"male","guardian":{"name":"Awa Ndiaye","relationship":"Mère","phone":"+221701112233"}}')" | jq -r '.id // empty')
ENCOUNTER_ID=$(body "$(api POST "$DOCTOR" "/api/patients/${PATIENT_ID}/encounters" '{"reason":"Fièvre","vitals":{"temperature":38.9,"weight":11.4}}')" | jq -r '.encounterId // empty')
[ -n "$PATIENT_ID" ] && [ -n "$ENCOUNTER_ID" ] || fail "création du patient ou de la consultation."
RX=$(body "$(api POST "$DOCTOR" "/api/encounters/${ENCOUNTER_ID}/prescriptions" '{"medication":"Paracétamol sirop 120 mg/5 mL","dosage":"5 mL toutes les 6 h","formularyCode":"PARA-SIR","doseMg":120,"dosesPerDay":4,"doseConfirmed":true}')" | jq -r '.prescriptionId // empty')
[ -n "$RX" ] || fail "création de l'ordonnance."

FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(body "$(api GET "$PHARM" /api/pharmacy/prescriptions)" | jq -r --arg id "$RX" '.prescriptions[] | select(.id==$id) | .patientName')
  [ -n "$FOUND" ] && break
  sleep 2
done
[ -n "$FOUND" ] || fail "l'ordonnance n'apparaît pas dans la file de la pharmacie."
echo "OK : l'ordonnance de ${FOUND} apparaît à délivrer."

BEFORE=$(stock_of PARA-SIR)
[ "$(status "$(api POST "$PHARM" "/api/pharmacy/prescriptions/${RX}/dispense" '{"itemCode":"PARA-SIR","quantity":2}')")" = "201" ] || fail "délivrance refusée."
AFTER=$(stock_of PARA-SIR)
[ "$AFTER" -eq $((BEFORE - 2)) ] || fail "stock attendu $((BEFORE - 2)) après délivrance, obtenu $AFTER."
echo "OK : délivrance de 2 flacons (stock ${BEFORE} -> ${AFTER})."

# --- 4. Refus ------------------------------------------------------------------------
[ "$(status "$(api POST "$PHARM" "/api/pharmacy/prescriptions/${RX}/dispense" '{"itemCode":"PARA-SIR","quantity":1}')")" = "409" ] || fail "une 2e délivrance devrait donner 409."
RX2=$(body "$(api POST "$DOCTOR" "/api/encounters/${ENCOUNTER_ID}/prescriptions" '{"medication":"Zinc 20 mg dispersible","dosage":"1 cp par jour"}')" | jq -r '.prescriptionId // empty')
sleep 2
MISMATCH=$(api POST "$PHARM" "/api/pharmacy/prescriptions/${RX2}/dispense" '{"itemCode":"CEFTRI-1G","quantity":1}')
[ "$(status "$MISMATCH")" = "409" ] && [ "$(body "$MISMATCH" | jq -r '.kind')" = "mismatch" ] || fail "article différent du médicament prescrit : confirmation non exigée."
echo "OK : article différent du médicament prescrit refusé sans confirmation."
CODE=$(status "$(api POST "$PHARM" "/api/pharmacy/prescriptions/${RX2}/dispense" '{"itemCode":"CEFTRI-1G","quantity":999999,"confirmMismatch":true}')")
[ "$CODE" = "409" ] || fail "une quantité supérieure au stock devrait donner 409 (reçu ${CODE})."
echo "OK : 2e délivrance et quantité supérieure au stock refusées (409)."

echo "Terminé : pharmacie vérifiée de bout en bout."
