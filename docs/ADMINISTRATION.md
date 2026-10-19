# Guide d'administration

Pour l'administrateur technique et la direction de l'établissement.

## Comptes et rôles

Écran **Comptes** (administrateur technique) : créer un compte, le désactiver, réinitialiser un mot de passe.

| Rôle | Écrans (hors « Mon profil » et « Paramètres », communs à tous) |
| --- | --- |
| Réceptionniste | File active, Admission, Rendez-vous |
| Infirmière | Tableau de bord, File active (avec tri), Admission, Rendez-vous, Dossier patient, Gestion des lits, Vaccinations |
| Médecin | Tableau de bord, File active, Admission, Rendez-vous (son agenda), Consultations, Dossier patient, Gestion des lits, Vaccinations |
| Technicien labo | Laboratoire, Dossier patient |
| Radiologue | Radiologie, Dossier patient |
| Pharmacien | Pharmacie |
| Caissier | Facturation |
| Directeur | Tableau de bord, File active, Facturation (lecture et tarifs), Dossier patient, Journal d'audit, Gestion des lits, Statistiques, Rapports |
| Administrateur technique | Supervision, Comptes, Journal d'audit, Flux FHIR, Gestion des lits, Rapports |

Le détail exact, route par route, est dans [ROLES-ET-ROUTES.md](ROLES-ET-ROUTES.md), généré depuis le code. **Le contrôle est fait par le serveur** à chaque appel ; masquer un écran n'est qu'un confort.

Un compte désactivé perd l'accès **immédiatement**, même si l'utilisateur est connecté. Après 5 mots de passe erronés, la connexion est bloquée 15 minutes pour cet utilisateur depuis ce poste.

Les mots de passe font 8 caractères minimum. Il n'y a pas d'authentification à deux facteurs ni de « mot de passe oublié » autonome : l'administrateur réinitialise.

## Tarifs (direction)

Écran **Facturation → Tarifs** : prix de la consultation, des examens de laboratoire et d'imagerie, et de chaque médicament du formulaire. Tant que la direction n'a pas enregistré sa grille, des **tarifs d'exemple** s'appliquent et un bandeau le signale.

La devise se règle avec `BILLING_CURRENCY` dans `apps/backend/.env` (`XOF` par défaut).

La facture d'une consultation regroupe : la consultation, les examens demandés pendant cette consultation et les médicaments délivrés pour elle. Le caissier peut y indiquer un assureur ou une mutuelle et un taux de prise en charge ; le patient ne paie que sa part.

## Listes de référence

| Liste | Où | Comment la changer |
| --- | --- | --- |
| Examens de laboratoire (LOINC) | `apps/backend/src/lib/lab-catalog.ts` | Modifier le fichier, reconstruire le backend |
| Diagnostics (CIM-10) | `apps/backend/src/lib/diagnoses.ts` | idem |
| Formulaire pharmaceutique | `apps/backend/src/lib/formulary.ts` | idem (articles, unités, seuils de réapprovisionnement) |
| Vaccins | `apps/backend/src/lib/vaccines.ts` | idem |
| **Calendrier vaccinal** | `apps/backend/data/vaccine-schedule.json` | Déposer un fichier : il remplace le calendrier d'exemple, sans reconstruction |

Ces listes sont des **listes de départ**, écrites de mémoire (codes LOINC, CIM-10, formulaire, calendrier PEV). **Elles doivent être validées par le biologiste, le médecin responsable de l'information médicale et le pharmacien de l'établissement avant l'usage réel.** Les valeurs de référence biologiques ne sont volontairement pas préremplies : le laboratoire les saisit avec chaque résultat.

Format du calendrier vaccinal personnalisé (`vaccine-schedule.json`) :

```json
[
  { "vaccine": "BCG", "dose": 1, "dueDays": 0, "label": "Naissance" },
  { "vaccine": "PENTA", "dose": 1, "dueDays": 42, "label": "6 semaines" }
]
```
`vaccine` est un code du catalogue de vaccins, `dueDays` l'âge recommandé en jours.

## Rendez-vous

Réglés dans `apps/backend/.env` : `APPOINTMENT_START_HOUR`, `APPOINTMENT_END_HOUR`, `APPOINTMENT_SLOT_MINUTES` et `HOSPITAL_UTC_OFFSET_MINUTES` (0 pour le Sénégal). Un créneau ne peut être réservé qu'une fois par médecin.

## Rapports et DHIS2

Écran **Rapports** (direction, administrateur technique) : indicateurs d'un mois (consultations par tranche d'âge et par sexe, hospitalisations, examens, vaccinations, diagnostics CIM-10), export **CSV** pour Excel et fichier **DHIS2**.

Pour que l'export DHIS2 fonctionne, l'administrateur technique renseigne une fois la **correspondance** (zone de texte sous le tableau) avec les identifiants de votre instance DHIS2 :

```json
{
  "orgUnit": "<identifiant de l'établissement dans DHIS2>",
  "dataSet": "<identifiant du jeu de données, facultatif>",
  "dataElements": {
    "consultations": "<identifiant de l'élément de données>",
    "dx_B50.9": "<identifiant pour le paludisme à P. falciparum>"
  }
}
```

Les identifiants DHIS2 (11 caractères) sont propres à chaque pays ; **ils ne sont pas fournis par Pédiatrix** : les obtenir auprès de l'équipe DHIS2 du ministère. Les indicateurs sans correspondance sont ignorés dans le fichier et listés. Les diagnostics s'écrivent `dx_` suivi du code CIM-10. Le fichier est au format `dataValueSet` ; son **import dans une instance DHIS2 réelle n'a pas été testé**.

## Journal d'audit

Écran **Journal d'audit** (direction, administrateur technique) : qui s'est connecté (ou a échoué), qui a lu ou modifié quel dossier, et quels accès ont été refusés. Les rafraîchissements automatiques des listes ne sont pas journalisés. On peut filtrer par dossier patient. Le journal est conservé dans HAPI (ressources `AuditEvent`) et donc dans les sauvegardes ; il n'y a pas de purge automatique.

## Identité de l'établissement

`FACILITY_NAME`, `FACILITY_ADDRESS`, `FACILITY_PHONE` dans `apps/backend/.env` : en-tête des ordonnances, comptes rendus, carnets de vaccination et factures imprimés.

## Impression

Les boutons « Imprimer » ouvrent la boîte de dialogue d'impression du système, qui permet aussi d'**enregistrer en PDF**. La mise en page n'a pas été vérifiée sur une imprimante réelle.

## Dépannage

| Symptôme | Piste |
| --- | --- |
| Bandeau « serveur injoignable » | Le serveur ou le réseau est coupé ; `docker compose --profile full ps` sur le serveur ; l'adresse figée dans l'application (`VITE_BACKEND_URL`) est-elle la bonne ? |
| « Trop de tentatives » à la connexion | Attendre 15 minutes, ou redémarrer le backend (le compteur est en mémoire) |
| Écran Lits vide | Lancer `npx tsx src/scripts/seed-beds.ts` (une fois) |
| Export DHIS2 refusé (409) | Correspondance non configurée (section précédente) |
| Résultat de labo qui n'apparaît pas tout de suite | HAPI peut garder une recherche en cache quelques secondes ; l'écran se rafraîchit seul |
| Electron plante au lancement avec `registerSchemesAsPrivileged` (développement) | La variable `ELECTRON_RUN_AS_NODE` est définie dans votre environnement ; `vite.config.ts` la retire désormais pour `npm run electron:dev` |
