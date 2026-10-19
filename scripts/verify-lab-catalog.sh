#!/usr/bin/env bash
# Vérifie bout-en-bout le laboratoire codé (catalogue LOINC), via le backend :
#   1. Le catalogue est lisible par le médecin et le technicien, refusé à l'infirmière (403)
#   2. Une demande avec examCode est refusée si le code est inconnu (400)
#   3. Une demande NFS (panel) remonte avec son examCode dans la file du labo
#   4. Un résultat numérique avec plage de référence revient au dossier patient
#      avec son drapeau (H/L/N) et sa plage ; un résultat texte reste lisible

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

login() {
  curl -sf -X POST "${BACKEND_URL}/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"${SEED_USER_PASSWORD}\"}" | jq -r '.token // empty'
}
DOCTOR_TOKEN=$(login medecin1); LAB_TOKEN=$(login labo1); NURSE_TOKEN=$(login infirmiere1)
[ -n "$DOCTOR_TOKEN" ] && [ -n "$LAB_TOKEN" ] && [ -n "$NURSE_TOKEN" ] || { echo "ÉCHEC : login sans token (seed-users ?)." >&2; exit 1; }
echo "OK : connecté (médecin, technicien, infirmière)."

fail() { echo "ÉCHEC : $1" >&2; exit 1; }

# --- 1. Catalogue et contrôle d'accès -----------------------------------------
code() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $1" "${BACKEND_URL}$2"; }
[ "$(code "$DOCTOR_TOKEN" /api/lab/catalog)" = "200" ] || fail "le médecin devrait lire le catalogue."
[ "$(code "$LAB_TOKEN" /api/lab/catalog)" = "200" ] || fail "le technicien devrait lire le catalogue."
[ "$(code "$NURSE_TOKEN" /api/lab/catalog)" = "403" ] || fail "l'infirmière devrait être bloquée (403)."
echo "OK : catalogue lisible par médecin et technicien, bloqué (403) pour l'infirmière."

# --- Patient et consultation fictifs ------------------------------------------
PATIENT_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients" -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Aissatou","lastName":"Verify-Lab-Catalog","birthDate":"2020-03-14","gender":"female","guardian":{"name":"Fatou Sow","relationship":"Mère","phone":"+221701234567"}}' | jq -r '.id // empty')
[ -n "$PATIENT_ID" ] || fail "création du patient fictif."
ENCOUNTER_ID=$(curl -sf -X POST "${BACKEND_URL}/api/patients/${PATIENT_ID}/encounters" -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" -d '{"reason":"Pâleur","vitals":{"temperature":37.5,"weight":12.1}}' | jq -r '.encounterId // empty')
[ -n "$ENCOUNTER_ID" ] || fail "création de la consultation."

# --- 2. Code d'examen inconnu --------------------------------------------------
BAD=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/service-requests" \
  -H "Authorization: Bearer ${DOCTOR_TOKEN}" -H "Content-Type: application/json" \
  -d '{"exam":"Inconnu","requester":"Dr. Verify","examCode":"0000-0"}')
[ "$BAD" = "400" ] || fail "un code d'examen inconnu devrait donner 400 (reçu ${BAD})."
echo "OK : code d'examen inconnu refusé (400)."

# --- 3. Demande NFS codée -------------------------------------------------------
SR_ID=$(curl -sf -X POST "${BACKEND_URL}/api/encounters/${ENCOUNTER_ID}/service-requests" -H "Authorization: Bearer ${DOCTOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"exam":"Numération formule sanguine (NFS)","requester":"Dr. Verify","examCode":"58410-2"}' | jq -r '.serviceRequestId // empty')
[ -n "$SR_ID" ] || fail "création de la demande NFS."

FOUND=""
for _ in $(seq 1 15); do
  FOUND=$(curl -sf -H "Authorization: Bearer ${LAB_TOKEN}" -H "Cache-Control: no-cache" "${BACKEND_URL}/api/lab/requests" \
    | jq -r --arg id "$SR_ID" '.requests[] | select(.id == $id) | .examCode // empty')
  [ -n "$FOUND" ] && break
  sleep 2
done
[ "$FOUND" = "58410-2" ] || fail "la demande NFS n'apparaît pas avec son examCode dans la file du labo."
echo "OK : la demande NFS remonte au labo avec examCode ${FOUND}."

# --- 4. Résultats : numérique avec plage + texte --------------------------------
curl -sf -X POST "${BACKEND_URL}/api/lab/requests/${SR_ID}/report" -H "Authorization: Bearer ${LAB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"results":[{"label":"Hémoglobine","value":"8.2","code":"718-7","referenceLow":"11","referenceHigh":"14"},{"label":"Remarque","value":"Frottis normal"}],"conclusion":"Anémie"}' >/dev/null \
  || fail "envoi du rapport."

RESULTS=""
for _ in $(seq 1 15); do
  RESULTS=$(curl -sf -H "Authorization: Bearer ${DOCTOR_TOKEN}" -H "Cache-Control: no-cache" "${BACKEND_URL}/api/patients/${PATIENT_ID}/reports" \
    | jq -c '.reports[0].results // empty')
  [ -n "$RESULTS" ] && break
  sleep 2
done
[ -n "$RESULTS" ] || fail "le rapport n'apparaît pas dans le dossier patient."
echo "$RESULTS" | jq -e '.[] | select(.label=="Hémoglobine") | select(.value=="8.2 g/dL" and .flag=="L" and .reference=="11 – 14")' >/dev/null \
  || fail "résultat numérique inattendu : ${RESULTS}"
echo "$RESULTS" | jq -e '.[] | select(.label=="Remarque" and .value=="Frottis normal")' >/dev/null \
  || fail "résultat texte inattendu : ${RESULTS}"
echo "OK : Hémoglobine 8.2 g/dL (bas, réf. 11 – 14) et résultat texte relus dans le dossier patient."

echo "Terminé : laboratoire codé vérifié de bout en bout."
