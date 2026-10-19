# Licences des composants tiers

Registre à tenir à jour (voir le skill `hospital-cleanroom`). Relevé automatique des
dépendances installées (octobre 2026) ; aucune n'est GPL, AGPL ni SSPL.

| Périmètre | Licences rencontrées |
|---|---|
| Backend | MIT (70), ISC (8), BSD-3 (4), Apache-2.0 (3), BSD-2 (1) |
| Poste (Electron/React) | MIT (249), ISC (27), Apache-2.0 (12), BSD-3 (10), BSD-2 (6), BlueOak-1.0.0 (6), MPL-2.0 (3), WTFPL, 0BSD, CC-BY-4.0, OFL-1.1, Python-2.0 |

## À faire avant la première vente
- Lister les 3 paquets MPL-2.0 et vérifier que leurs fichiers ne sont pas modifiés (sinon publier ces fichiers).
- Joindre les avis de licence (fichier de notices) aux installateurs.
- Vérifier les conditions de redistribution de LOINC, CIEL et CIM-10 avant d'embarquer leurs libellés.
- HAPI FHIR (Apache-2.0) et PostgreSQL (licence PostgreSQL) sont lancés comme services séparés et non modifiés.

## Sources d'inspiration (aucun code repris)
Aucun code repris. Documentation publique consultée (octobre 2026), idées seulement :
- OpenMRS (MPL-2.0), « Controlling User Access (Roles and Privileges) » : droits découpés par type de donnée et par action (voir, ajouter, modifier), regroupés en rôles par métier.
- Bahmni (AGPL-3.0), « Security Roles and Privileges » : rôles additifs, rôle de lecture clinique seule, rôle dédié aux commandes.
- OpenMRS, « Emergency Department Triage Application » (spécification) et [file d'attente](https://openmrs.atlassian.net/wiki/spaces/projects/pages/27009138/Queueing+Especially+Patient+Queues) : file triée par gravité puis temps d'attente, sortie « consultation commencée » ou « parti sans être vu ».
- Bahmni, [Patient Queues & Observation Forms Configuration](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/2941681665) : files configurables par service.
Applications : temps d'attente et sortie « parti sans consultation » dans la file active (`leave-without-consultation.route.ts`).

- Bahmni, [Configure rules based medication dosage](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/3464527901/Configure+rules+based+medication+dosage) et [Prescribing Medications](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/40501375/Prescribing+Medications) : doses cadrées par des règles mg/kg, voie, fréquence et durée par ordonnance.
- HL7 EHR-S Functional Model (norme ouverte), exigence d'alertes sur dosage propre au patient, interactions et allergies, avec traçabilité du passage outre.
Application : contrôle de la dose quotidienne par kg (`lib/dose-rules.ts`, maxima « à valider » par le pharmacien responsable), confirmation tracée par extension FHIR.

Application des droits : principe du besoin d'en connaître (`apps/backend/src/lib/clinical-access.ts`), formulé et écrit par nous.

Toute reprise de code doit être inscrite ici avec projet, licence, fichier et justification.
