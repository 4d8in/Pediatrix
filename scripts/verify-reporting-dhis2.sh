#!/usr/bin/env bash
# Vérifie les indicateurs mensuels et l'export DHIS2, via le backend uniquement :
#   1. Contrôle d'accès : médecin et infirmière bloqués (403) ; direction et admin technique autorisés
#   2. Sans correspondance DHIS2, l'export est refusé (409) ; les indicateurs restent disponibles
#   3. Une consultation du mois augmente l'indicateur « consultations »
#   4. Avec une correspondance, le fichier dataValueSet contient les valeurs mises en correspondance
# La correspondance DHIS2 existante est sauvegardée puis restaurée à la fin.

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

ADMIN=$(login admin1); DIRECTOR=$(login directeur1); DOCTOR=$(login medecin1); NURSE=$(login infirmiere1)
[ -n "$ADMIN" ] && [ -n "$DIRECTOR" ] && [ -n "$DOCTOR" ] && [ -n "$NURSE" ] || fail "login sans token."
PERIOD=$(date -u +%Y%m)
echo "OK : connecté. Période testée : ${PERIOD}."

# Sauvegarde de la correspondance existante (restaurée à la fin, même en cas d'échec).
SAVED=$(body "$(api GET "$ADMIN" /api/reporting/dhis2/mapping)" | jq -c '.mapping')
restore() {
  if [ "$SAVED" = "null" ] || [ -z "$SAVED" ]; then
    api DELETE "$ADMIN" /api/reporting/dhis2/mapping >/dev/null 2>&1 || true
  else
    api PUT "$ADMIN" /api/reporting/dhis2/mapping "$SAVED" >/dev/null 2>&1 || true
  fi
}
trap restore EXIT

# --- 1. Contrôle d'accès ---------------------------------------------------------
[ "$(status "$(api GET "$DOCTOR" "/api/reporting/indicators?period=${PERIOD}")")" = "403" ] || fail "le médecin devrait être bloqué (403)."
[ "$(status "$(api GET "$NURSE" "/api/reporting/dhis2?period=${PERIOD}")")" = "403" ] || fail "l'infirmière devrait être bloquée (403)."
[ "$(status "$(api GET "$DIRECTOR" "/api/reporting/indicators?period=${PERIOD}")")" = "200" ] || fail "la direction devrait lire les indicateurs."
[ "$(status "$(api PUT "$DIRECTOR" /api/reporting/dhis2/mapping '{}')")" = "403" ] || fail "la direction ne devrait pas modifier la correspondance (403)."
echo "OK : médecin et infirmière bloqués ; direction autorisée (lecture seule de la correspondance)."

# --- 2. Sans correspondance --------------------------------------------------------
api DELETE "$ADMIN" /api/reporting/dhis2/mapping >/dev/null
[ "$(status "$(api GET "$DIRECTOR" "/api/reporting/dhis2?period=${PERIOD}")")" = "409" ] || fail "l'export sans correspondance devrait donner 409."
[ "$(status "$(api GET "$DIRECTOR" "/api/reporting/dhis2?period=202613")")" = "400" ] || fail "une période invalide devrait donner 400."
echo "OK : export refusé sans correspondance (409), période invalide refusée (400)."

# --- 3. Une consultation du mois ----------------------------------------------------------
BEFORE=$(body "$(api GET "$DIRECTOR" "/api/reporting/indicators?period=${PERIOD}")" | jq -r '.indicators[] | select(.id=="consultations") | .value')
PATIENT_ID=$(body "$(api POST "$DOCTOR" /api/patients '{"firstName":"Astou","lastName":"Verify-Reporting","birthDate":"2024-03-03","gender":"female","guardian":{"name":"Seynabou Gueye","relationship":"Mère","phone":"+221701555000"}}')" | jq -r '.id // empty')
[ -n "$PATIENT_ID" ] || fail "création du patient."
body "$(api POST "$DOCTOR" "/api/patients/${PATIENT_ID}/encounters" '{"reason":"Contrôle","vitals":{"temperature":37.0,"weight":11.0}}')" >/dev/null
AFTER=""
for _ in $(seq 1 15); do
  AFTER=$(body "$(api GET "$DIRECTOR" "/api/reporting/indicators?period=${PERIOD}")" | jq -r '.indicators[] | select(.id=="consultations") | .value')
  [ "$AFTER" -gt "$BEFORE" ] && break
  sleep 2
done
[ "$AFTER" -gt "$BEFORE" ] || fail "l'indicateur « consultations » n'a pas augmenté (${BEFORE} -> ${AFTER})."
echo "OK : consultations ${BEFORE} -> ${AFTER} après une consultation."

# --- 4. Export avec correspondance -------------------------------------------------------------
[ "$(status "$(api PUT "$ADMIN" /api/reporting/dhis2/mapping '{"orgUnit":"bad","dataElements":{}}')")" = "400" ] || fail "une correspondance invalide devrait donner 400."
[ "$(status "$(api PUT "$ADMIN" /api/reporting/dhis2/mapping '{"orgUnit":"Ab12CdEf34G","dataElements":{"consultations":"AAAAAAAAAA1"}}')")" = "200" ] || fail "enregistrement de la correspondance refusé."
EXPORT=$(body "$(api GET "$DIRECTOR" "/api/reporting/dhis2?period=${PERIOD}")")
VALUE=$(jq -r '.dataValueSet.dataValues[] | select(.dataElement=="AAAAAAAAAA1") | .value' <<<"$EXPORT")
[ "$VALUE" = "$AFTER" ] || fail "valeur DHIS2 attendue ${AFTER}, obtenue '${VALUE}'."
[ "$(jq -r '.dataValueSet.orgUnit' <<<"$EXPORT")" = "Ab12CdEf34G" ] || fail "orgUnit absent du fichier."
jq -e '.unmapped | index("immunizations")' <<<"$EXPORT" >/dev/null || fail "les indicateurs non mis en correspondance devraient être listés."
echo "OK : fichier dataValueSet exporté (consultations = ${VALUE}), indicateurs non mappés listés."

echo "Terminé : rapports et export DHIS2 vérifiés. (Correspondance d'origine restaurée.)"
