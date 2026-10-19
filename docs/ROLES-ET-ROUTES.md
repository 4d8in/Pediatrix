# Rôles et routes

Tableau généré automatiquement depuis le code (`scripts/docs/access-matrix.ts`) : il ne peut pas diverger des contrôles réellement appliqués.
Chaque route de l'API vérifie le jeton (`authenticate`) puis le rôle (`authorize`) ; le masquage des écrans côté interface n'est qu'un confort.

93 routes.

## croissance

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/patients/:id/growth` | Médecin, Infirmière |
| POST | `/api/patients/:id/growth` | Médecin, Infirmière |

## facturation

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/billing/encounters` | Caissier |
| POST | `/api/billing/encounters/:id/invoice` | Caissier |
| GET | `/api/billing/invoices` | Caissier, Directeur |
| POST | `/api/billing/invoices/:id/payments` | Caissier |
| GET | `/api/billing/summary` | Caissier, Directeur |
| GET | `/api/billing/tariffs` | Caissier, Directeur, Admin technique |
| PUT | `/api/billing/tariffs` | Directeur, Admin technique |

## hospitalisation

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/beds` | Infirmière, Médecin, Directeur, Admin technique |
| POST | `/api/beds/:id/status` | Infirmière, Admin technique |
| POST | `/api/hospitalisations` | Infirmière, Médecin |
| GET | `/api/hospitalisations/:id/administrations` | Infirmière, Médecin |
| POST | `/api/hospitalisations/:id/administrations` | Infirmière |
| POST | `/api/hospitalisations/:id/discharge` | Infirmière, Médecin |
| POST | `/api/hospitalisations/:id/transfer` | Infirmière, Médecin |
| POST | `/api/patients/:id/deceased/revoke` | Médecin |
| GET | `/api/patients/:id/stays` | Infirmière, Médecin |

## laboratoire

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/lab/catalog` | Médecin, Technicien labo |
| GET | `/api/lab/requests` | Technicien labo |
| GET | `/api/lab/requests/:id/reference-ranges` | Technicien labo |
| POST | `/api/lab/requests/:id/report` | Technicien labo |
| GET | `/api/lab/summary` | Technicien labo |

## naissance

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/patients/:id/birth` | Infirmière, Médecin |
| POST | `/api/patients/:id/birth` | Infirmière, Médecin |

## pediatrie

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/diagnoses/catalog` | Médecin, Directeur |
| POST | `/api/encounters/:id/diagnoses` | Médecin |
| POST | `/api/encounters/:id/service-requests` | Médecin |
| POST | `/api/patients/:id/arrival` | Infirmière, Médecin, Réceptionniste |
| POST | `/api/patients/:id/arrival/left` | Infirmière, Médecin, Réceptionniste |
| GET | `/api/patients/:id/diagnoses` | Infirmière, Médecin |
| POST | `/api/patients/:id/encounters` | Médecin |
| POST | `/api/patients/:id/triage` | Infirmière, Médecin |

## pharmacie

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/pharmacy/formulary` | Pharmacien, Médecin |
| GET | `/api/pharmacy/prescriptions` | Pharmacien |
| POST | `/api/pharmacy/prescriptions/:id/dispense` | Pharmacien |
| GET | `/api/pharmacy/stock` | Pharmacien, Directeur |
| POST | `/api/pharmacy/stock/receipts` | Pharmacien |

## prescription

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| POST | `/api/encounters/:id/prescriptions` | Médecin |
| GET | `/api/patients/:id/allergies` | Infirmière, Médecin |
| POST | `/api/patients/:id/allergies` | Médecin, Infirmière |
| GET | `/api/patients/:id/prescriptions` | Infirmière, Médecin |

## ptme

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/patients/:id/ptme` | Infirmière, Médecin |
| POST | `/api/patients/:id/ptme` | Infirmière, Médecin |
| POST | `/api/patients/:id/ptme/tests` | Infirmière, Médecin |
| POST | `/api/patients/:id/ptme/tests/:milestone/revoke` | Médecin |

## radiologie

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| POST | `/api/encounters/:id/imaging-requests` | Médecin |
| GET | `/api/imaging/requests` | Radiologue |
| POST | `/api/imaging/requests/:id/report` | Radiologue |
| GET | `/api/imaging/summary` | Radiologue |
| GET | `/api/patients/:id/imaging-reports` | Infirmière, Médecin, Radiologue |

## reference

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| POST | `/api/encounters/:id/referral` | Médecin |
| GET | `/api/patients/:id/referrals` | Infirmière, Médecin |

## rendez-vous

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/appointments` | Réceptionniste, Infirmière, Médecin, Directeur |
| POST | `/api/appointments` | Réceptionniste, Infirmière |
| POST | `/api/appointments/:id/status` | Réceptionniste, Infirmière, Médecin |
| GET | `/api/appointments/doctors` | Réceptionniste, Infirmière, Médecin, Directeur |
| GET | `/api/appointments/slots` | Réceptionniste, Infirmière, Médecin |

## routes

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/dashboard/counters` | Infirmière, Médecin, Directeur |
| GET | `/api/dashboard/overview` | Infirmière, Médecin, Directeur |
| GET | `/api/facility` | Tout utilisateur connecté |
| GET | `/api/fhir-log` | Admin technique |
| GET | `/api/health` | Public (sans connexion) |
| GET | `/api/queue` | Infirmière, Médecin, Réceptionniste, Directeur |
| GET | `/api/reporting/dhis2` | Directeur, Admin technique |
| DELETE | `/api/reporting/dhis2/mapping` | Admin technique |
| GET | `/api/reporting/dhis2/mapping` | Admin technique |
| PUT | `/api/reporting/dhis2/mapping` | Admin technique |
| GET | `/api/reporting/indicators` | Directeur, Admin technique |
| POST | `/api/results/:id/read` | Médecin |
| GET | `/api/results/recent` | Médecin |
| GET | `/api/stats` | Directeur, Admin technique |
| GET | `/api/surveillance/weekly` | Directeur, Médecin, Admin technique |
| GET | `/updates/:file` | Public (sans connexion) |

## socle/audit

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/audit` | Admin technique, Directeur |
| GET | `/api/audit/verify` | Admin technique |

## socle/auth

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| POST | `/api/auth/login` | Public (sans connexion) |
| GET | `/api/auth/me` | Tout utilisateur connecté |
| POST | `/api/auth/password` | Tout utilisateur connecté |
| GET | `/api/me/profile` | Tout utilisateur connecté |
| PUT | `/api/me/profile` | Tout utilisateur connecté |
| GET | `/api/users` | Admin technique |
| POST | `/api/users` | Admin technique |
| POST | `/api/users/:username/active` | Admin technique |
| POST | `/api/users/:username/password` | Admin technique |

## socle/patients

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/patients` | Infirmière, Médecin, Technicien labo, Radiologue, Réceptionniste, Directeur |
| POST | `/api/patients` | Infirmière, Médecin, Réceptionniste |
| GET | `/api/patients/:id` | Infirmière, Médecin, Technicien labo, Radiologue, Directeur |
| GET | `/api/patients/:id/reports` | Infirmière, Médecin, Technicien labo |

## vaccination

| Méthode | Route | Rôles autorisés |
| --- | --- | --- |
| GET | `/api/patients/:id/immunizations` | Médecin, Infirmière |
| POST | `/api/patients/:id/immunizations` | Médecin, Infirmière |
| GET | `/api/patients/:id/vaccination-schedule` | Médecin, Infirmière |
| GET | `/api/vaccines/catalog` | Médecin, Infirmière |
