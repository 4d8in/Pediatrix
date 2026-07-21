#!/usr/bin/env bash
# Crée (de façon idempotente) les 5 comptes de test — un par rôle — utilisés
# pour l'authentification :
#   - Practitioner + PractitionerRole dans HAPI (identité et rôle, socle FHIR)
#   - hash du mot de passe dans apps/backend/data/users.json (jamais dans HAPI,
#     jamais exposé par une route HTTP)
#
# Ré-exécutable sans dupliquer les ressources ni écraser les id déjà en place.
# Nécessite SEED_USER_PASSWORD dans apps/backend/.env.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/apps/backend"

npx tsx src/scripts/seed-users.ts
