#!/usr/bin/env bash
# Vérifie les protections de sécurité du backend :
#   1. En-têtes de sécurité et absence de cache sur l'API
#   2. Limitation des essais de connexion (429 après 5 échecs)
#   3. Journal d'audit : la lecture d'un dossier par un médecin est tracée ; journal réservé à l'admin/direction
#   4. Un compte désactivé perd l'accès immédiatement, même avec un jeton encore valide

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
    -d "{\"username\":\"$1\",\"password\":\"${2:-$SEED_USER_PASSWORD}\"}" | jq -r '.token // empty'
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

ADMIN=$(login admin1); DOCTOR=$(login medecin1); NURSE=$(login infirmiere1)
[ -n "$ADMIN" ] && [ -n "$DOCTOR" ] && [ -n "$NURSE" ] || fail "login sans token."
echo "OK : connecté (admin, médecin, infirmière)."

# --- 1. En-têtes ---------------------------------------------------------------
HEADERS=$(curl -s -D - -o /dev/null -H "Authorization: Bearer ${DOCTOR}" "${BACKEND_URL}/api/auth/me" | tr -d '\r')
grep -qi '^x-content-type-options: nosniff' <<<"$HEADERS" || fail "en-tête X-Content-Type-Options absent."
grep -qi '^x-frame-options: DENY' <<<"$HEADERS" || fail "en-tête X-Frame-Options absent."
grep -qi '^cache-control: no-store' <<<"$HEADERS" || fail "l'API devrait répondre Cache-Control: no-store."
echo "OK : en-têtes de sécurité présents, API non mise en cache."

# --- 2. Limitation des essais ---------------------------------------------------------
GHOST="verify-throttle-$$"
for _ in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"${GHOST}\",\"password\":\"mauvais-mot-de-passe\"}"
done
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"${GHOST}\",\"password\":\"mauvais-mot-de-passe\"}")
[ "$CODE" = "429" ] || fail "la 6e tentative devrait donner 429 (reçu ${CODE})."
echo "OK : 6e tentative de connexion refusée (429)."

# --- 3. Journal d'audit -----------------------------------------------------------------
PATIENT_ID=$(body "$(api POST "$DOCTOR" /api/patients '{"firstName":"Cheikh","lastName":"Verify-Security","birthDate":"2018-06-01","gender":"male","guardian":{"name":"Binta Sy","relationship":"Mère","phone":"+221701000111"}}')" | jq -r '.id // empty')
[ -n "$PATIENT_ID" ] || fail "création du patient fictif."
api GET "$DOCTOR" "/api/patients/${PATIENT_ID}" >/dev/null

FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(body "$(api GET "$ADMIN" "/api/audit?patientId=${PATIENT_ID}")" | jq -r '[.events[] | select(.action=="R" and .role=="doctor" and .success==true)] | length')
  [ "${FOUND:-0}" -ge 1 ] && break
  sleep 2
done
[ "${FOUND:-0}" -ge 1 ] || fail "la lecture du dossier par le médecin n'apparaît pas dans le journal."
[ "$(status "$(api GET "$NURSE" /api/audit)")" = "403" ] || fail "l'infirmière ne devrait pas lire le journal (403)."
[ "$(status "$(api GET "$DOCTOR" /api/audit)")" = "403" ] || fail "le médecin ne devrait pas lire le journal (403)."
echo "OK : lecture du dossier tracée (médecin) ; journal interdit à l'infirmière et au médecin (403)."

# --- 4. Révocation immédiate ----------------------------------------------------------------------
TMP="verify-revoke-$$"
curl -sf -X POST "${BACKEND_URL}/api/users" -H "Authorization: Bearer ${ADMIN}" -H "Content-Type: application/json" \
  -d "{\"username\":\"${TMP}\",\"displayName\":\"Compte de test\",\"role\":\"nurse\",\"password\":\"${SEED_USER_PASSWORD}\"}" >/dev/null || fail "création du compte temporaire."
TOKEN=$(login "$TMP")
[ -n "$TOKEN" ] || fail "connexion du compte temporaire."
[ "$(status "$(api GET "$TOKEN" /api/auth/me)")" = "200" ] || fail "le compte actif devrait accéder à /api/auth/me."
curl -sf -X POST "${BACKEND_URL}/api/users/${TMP}/active" -H "Authorization: Bearer ${ADMIN}" -H "Content-Type: application/json" -d '{"active":false}' >/dev/null || fail "désactivation du compte."
[ "$(status "$(api GET "$TOKEN" /api/auth/me)")" = "401" ] || fail "un compte désactivé devrait perdre l'accès immédiatement (401)."
echo "OK : compte désactivé -> jeton encore valide mais refusé immédiatement (401)."

echo "Terminé : sécurité vérifiée."
