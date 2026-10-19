# Architecture et extension

## Vue d'ensemble

```
Postes (application de bureau Electron + React)
        │  LAN — HTTP ou HTTPS (profil tls)
        ▼
Backend Node.js (Fastify)  ── SOCLE : identité patient · authentification et rôles · audit
        │                  └─ MODULES : Pédiatrie · Laboratoire · Radiologie · Vaccination
        │                               Croissance · Prescription · Pharmacie · Facturation
        │                               Rendez-vous · Hospitalisation
        ▼  ressources FHIR R4
Serveur HAPI FHIR  ──►  PostgreSQL « clinique »
                                │
                  [service d'agrégation, facultatif] ──► PostgreSQL « reporting » distant
```

Principes :

- **FHIR est le contrat d'échange.** Chaque module lit et écrit des ressources FHIR standard ; il n'importe jamais le code d'un autre module. Le code partagé est dans `src/lib/` ; le socle (patients, comptes, audit) est dans `src/socle/`.
- **Le backend est le seul à parler à HAPI.** HAPI n'a pas d'authentification : il n'est publié que sur la machine serveur (`127.0.0.1`).
- **Le contrôle d'accès est côté serveur** : chaque route passe par `authenticate` (jeton valide, compte actif) puis `authorize(rôles…)`. La liste complète est générée dans [ROLES-ET-ROUTES.md](ROLES-ET-ROUTES.md).
- **Une route = un fichier**, nommé `*.route.ts`, dans `src/modules/<module>/`.
- **Sans Internet** : aucune ressource distante (polices, images, CDN) ; Internet n'est requis que pour l'installation et le reporting distant facultatif.

## Ressources FHIR utilisées

| Ressource | Usage | Module |
| --- | --- | --- |
| `Patient` | identité, numéro de dossier (`PX-…`), tuteur | socle |
| `Practitioner` / `PractitionerRole` | utilisateurs et rôles | socle |
| `AuditEvent` | journal d'audit | socle |
| `Encounter` (AMB) | arrivée (`arrived`) puis consultation (`finished`) | pédiatrie |
| `Encounter` (IMP) | séjour hospitalier | hospitalisation |
| `Observation` | constantes (LOINC), tri, résultats de laboratoire (valeur, plage, interprétation), croissance | pédiatrie, laboratoire, croissance |
| `Condition` | diagnostics CIM-10 | pédiatrie |
| `ServiceRequest` / `DiagnosticReport` | demandes et comptes rendus de laboratoire et d'imagerie | pédiatrie, laboratoire, radiologie |
| `Immunization` | carnet vaccinal | vaccination |
| `AllergyIntolerance` / `MedicationRequest` | allergies, prescriptions | prescription |
| `MedicationDispense` / `SupplyDelivery` | délivrances et réceptions (le stock s'en déduit) | pharmacie |
| `Invoice` / `PaymentNotice` | factures et encaissements (le solde s'en déduit) | facturation |
| `Appointment` | rendez-vous | rendez-vous |
| `Location` | services et lits | hospitalisation |

Les codes locaux utilisent l'espace `http://pediatrix.local/fhir/…` (rôles, formulaire, vaccins, tri, numéro de dossier). Codes standards : LOINC (constantes et examens), UCUM (unités), CIM-10 (diagnostics), `v3-ObservationInterpretation` (drapeaux H/L/N).

## Données hors FHIR

Dans `apps/backend/data/` (volume Docker `pediatrix_backend_data`) : `users.json` (comptes et empreintes de mots de passe — jamais dans HAPI), `tariffs.json`, `dhis2-mapping.json`, `vaccine-schedule.json` (facultatif), résultats « lus ».

## Ajouter un module

Exemple : un module « Maternité ».

1. Créer `apps/backend/src/modules/maternite/` avec un fichier par route (`create-…route.ts`, `list-…route.ts`) et un fichier `*.fhir.ts` qui construit et relit les ressources FHIR (fonctions pures, testables sans HAPI).
2. Chaque route : `preHandler: [authenticate, authorize("rôle1", "rôle2")]`. Valider le corps de la requête et répondre aux erreurs de HAPI par une réponse propre (voir un module existant, par exemple `modules/rendez-vous/`).
3. Enregistrer les routes dans `src/index.ts` **après** `jwtPlugin`.
4. Si un nouveau rôle est nécessaire : l'ajouter dans `src/socle/auth/roles.ts` (backend), `apps/desktop/src/lib/types.ts` et `lib/roles.ts` (interface), et dans `seed-users.ts`.
5. Écran : `apps/desktop/src/views/<Ecran>.tsx`, appels dans `lib/api.ts`, types dans `lib/types.ts`, entrée dans `NAV_ITEMS` de `App.tsx`.
6. Tests : un fichier `apps/backend/test/<module>.test.ts` (logique pure) et un script `scripts/verify-<module>-flow.sh` qui prouve le flux **et** le blocage des rôles non autorisés.
7. Régénérer `docs/ROLES-ET-ROUTES.md` : `cd apps/backend && npx tsx ../../scripts/docs/access-matrix.ts`.

## Tests

| Quoi | Commande |
| --- | --- |
| Logique pure (≈ 76 tests) | `cd apps/backend && npm test` |
| Flux bout-en-bout via le backend | `./scripts/verify-<flux>.sh` (HAPI et backend démarrés) |
| Interface (Playwright, navigateur sans affichage) | `cd apps/desktop && E2E_PASSWORD=<SEED_USER_PASSWORD> npx playwright test` |

Les scripts `verify-*` créent des patients **fictifs** dans la base : ne pas les lancer sur une base de production.

## Limites connues

Voir la fin de [INSTALLATION.md](INSTALLATION.md) et [ADMINISTRATION.md](ADMINISTRATION.md). En résumé : pas de mode hors ligne sur les postes, pas de haute disponibilité, pas de synchronisation entre établissements, courbes de croissance de l'OMS non intégrées, une seule langue d'interface (français), listes de référence à faire valider localement.
