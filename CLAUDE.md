# Pédiatrix

Plateforme de gestion hospitalière **modulaire et extensible**, prototype de mémoire de licence.
Contexte : hôpital de district africain (cas d'étude : Sénégal).

## Règle d'or

**Modulaire et extensible — PAS "complet".**
On construit un socle + 2 modules qui marchent vraiment (Pédiatrie ↔ Laboratoire).
Radiologie / Pharmacie = extensibilité démontrée, pas implémentée.
Ne jamais élargir le périmètre sans que je le demande explicitement.

## Preuve de concept à démontrer

Deux services d'un même hôpital échangent des informations **structurées et standardisées**,
sans papier ni téléphone.

Flux bout-en-bout :
`Admission → Consultation (Pédiatrie) → ServiceRequest → Laboratoire → DiagnosticReport → HAPI → PostgreSQL`

## Principes directeurs

- **Offline-first** — fonctionne sans Internet (LAN uniquement)
- **Open source** — aucune dépendance propriétaire
- **Interopérable** — HL7 FHIR comme contrat d'échange
- **Contrôle d'accès granulaire** — par rôle

## Stack (figée — ne pas proposer d'alternatives)

| Couche | Choix |
|---|---|
| Client desktop | Electron (Windows + Linux) + React + TypeScript, packagé avec electron-builder |
| Backend | Node.js |
| Interopérabilité | Serveur HAPI FHIR (Docker) |
| Data store | PostgreSQL |
| Orchestration | Docker Compose |
| UI | Tailwind CSS + Shadcn/UI |

Contraintes :
- Electron = coquille minimale (`apps/desktop/electron/` : fenêtre + mises à jour).
  **Toute la logique métier est dans le backend Node.js.** Pas de `nodeIntegration` dans l'UI.
- Matériel cible modeste : rester léger (pas de dépendances lourdes dans l'UI).
- Mises à jour : `electron-updater` en source `generic`, servies par le backend sur le LAN
  (`GET /updates/:file`) — jamais depuis Internet.

## Architecture

```
Postes Electron (Accueil · Pédiatrie · Laboratoire)
        ↓ LAN (REST/FHIR)
Backend Node.js  ── SOCLE : identité patient · auth & rôles
                 └─ MODULES : Pédiatrie · Laboratoire · Radiologie (souche)
                              Vaccination · Croissance · Prescription · Hospitalisation (lits)
        ↓ produisent du FHIR
Serveur HAPI FHIR (Docker)
        ↓
PostgreSQL "clinique" ──[service d'agrégation]──> PostgreSQL "reporting"
```

**Contrat inter-modules = ressources FHIR.** Ajouter un module = le brancher au socle.
Un module ne doit **jamais** importer directement le code d'un autre module.

### Deux rôles pour PostgreSQL
- **clinique** : persistance de HAPI (dossiers vivants, ressources FHIR)
- **reporting** : tables analytiques alimentées par le service d'agrégation (stats simples)

## Ressources FHIR utilisées

| Ressource | Usage |
|---|---|
| `Patient` | identité unique (socle) |
| `Practitioner` / `PractitionerRole` | utilisateurs et rôles (socle) |
| `Encounter` | consultation pédiatrique |
| `Observation` | paramètres vitaux, croissance, vaccins |
| `ServiceRequest` | demande d'examen au laboratoire |
| `DiagnosticReport` | résultat d'examen |
| `Immunization` | carnet vaccinal (module Vaccination) |
| `AllergyIntolerance` / `MedicationRequest` | allergies et prescriptions (module Prescription) |
| `Location` | services (`wa`) et lits (`bd`, état dans `operationalStatus`) — module Hospitalisation |
| `Encounter` classe `IMP` | séjour hospitalier (les consultations sont en classe `AMB`) |

Futur (ne pas implémenter) : `ImagingStudy` (radiologie, Orthanc), dispensation pharmacie.

## Rôles utilisateurs

Alignés sur la maquette existante (`App.tsx` → `userRole`) :

`Infirmière` · `Médecin` · `Technicien Labo` · `Radiologue` · `Directeur` · `Administrateur technique`

Droits (déjà amorcés dans la nav de `App.tsx`) :
- Consultations / Prescriptions → `Médecin`, `Directeur`
- Vue **Flux FHIR** → `Administrateur technique` uniquement
- Stats → `Directeur` (+ selon besoin)

Auth par JWT. Toute route backend vérifie le rôle.
Les tests doivent prouver qu'un rôle non autorisé est **bloqué**.
Le sélecteur de rôle par clic (mode démo) doit être remplacé par une vraie authentification.

## Frontend : projet neuf + maquette de référence

**Le code est écrit dans un projet neuf et vierge** (Electron + React + TS + Tailwind).
La maquette `maquette_logiciel_hospitalier` est une **référence**, pas une base de code :
on ne l'étend pas, on ne copie pas son `package.json` ni sa config.
(Elle contient des résidus AI Studio — `@google/genai`, `express`, avatars distants — à ne jamais reprendre.)

### Ce qu'on reprend de la maquette
- **La direction visuelle** : mise en page, sidebar, design system, `lucide-react`, `motion`, `recharts`
- **Le modèle de rôles** et le verrouillage de navigation
- **Le scénario du flux** : demande NFS (Dr. Diallo → Labo) → résultats → dossier patient
- **Les exemples de ressources FHIR** de `FhirLog.tsx` : ils servent de **spécification** des ressources à produire
- **Le nom produit** : PediCare Africa / Pédiatrix

### Écrans à construire (périmètre réel)
| Écran | Rôle dans le flux |
|---|---|
| Login | authentification JWT |
| Admission | crée `Patient` |
| Consultations | crée `Encounter` + `Observation` |
| Dossier patient | lit le dossier — **découpé en sous-composants dès le départ** |
| Laboratoire | reçoit `ServiceRequest`, produit `DiagnosticReport` |
| Flux FHIR | affiche les vraies ressources émises (vitrine d'interopérabilité, rôle Admin technique) |
| Tableau de bord | données réelles du flux |
| Stats | lit PostgreSQL reporting |
| Radiologie | module-souche (même contrat que le Laboratoire) |
| Vaccinations | carnet vaccinal (`Immunization`) |

### Écrans ajoutés à la demande explicite du porteur du projet
| Écran | Rôles | Contenu |
|---|---|---|
| File active | infirmière, médecin, directeur | patients admis aujourd'hui, en attente / consultés |
| Gestion des lits | infirmière, médecin, directeur (lecture), admin technique (état des lits) | lits par service, hospitalisation, transfert, sortie |
| Paramètres | tous | compte, changement de mot de passe, aide |
| Comptes | admin technique | création, désactivation, réinitialisation du mot de passe |
| Supervision | admin technique | état backend / HAPI, volumes, dernières ressources |

Accueil spécialisé par rôle : tableau de bord « soins du jour » (infirmière), résultats
reçus non lus (médecin), compteurs du jour (labo, radiologie), activité par service
(directeur, dans Stats).

### Hors périmètre (présents dans la maquette — NE PAS construire)
`WardMap` · `CoordinationPings` · `ConflictResolver` · `Support`

(`Users` et `Settings` ont été ajoutés sous la forme « Comptes » et « Paramètres »,
à la demande explicite du porteur du projet.)

Croissance et Prescriptions/Allergies existent comme modules backend et sections du
dossier patient, pas comme écrans dédiés.

Ces écrans relèvent de la vision produit et de l'extensibilité, pas du prototype.
Ne pas les implémenter, ne pas leur créer de routes backend.

### Règles frontend
- Aucun mock codé en dur dans les composants : les données viennent du backend.
- Aucune ressource distante (images, polices, CDN) — **offline-first**.
- Pas de dépendance propriétaire ni de service cloud.

## Méthode de travail

**Tranche verticale d'abord, largeur ensuite.**
Ne jamais coder tous les écrans / tous les modules en parallèle.
Un flux complet qui traverse toutes les couches, puis on élargit.

### Ordre des étapes
1. `docker-compose` : HAPI FHIR + PostgreSQL → vérifier avec un `POST /Patient`
2. Scaffold **projet neuf** : Electron + React + TS + Tailwind, et backend Node.js → hello world bout-en-bout
3. **Tranche verticale** Pédiatrie → Labo (Patient → Encounter/Observation → ServiceRequest → DiagnosticReport → retour médecin)
4. Auth JWT + matrice de rôles + tests de blocage
5. Service d'agrégation → PostgreSQL reporting (nb patients, consultations, examens)
6. Module-souche Radiologie (preuve de modularité)
7. Finitions : offline-first minimal, packaging Electron + mises à jour LAN, tests fonctionnels

L'étape courante est la seule à traiter. Ne pas anticiper les suivantes.

## Conventions

- Français pour l'UI, les commentaires et les messages de commit.
- Code, noms de variables et de fichiers en anglais.
- Backend : une route = un fichier ; modules isolés dans `modules/<nom>/`.
- Ne jamais commiter de secrets ; utiliser `.env`.
- Données de test = patients fictifs uniquement. **Jamais de données réelles de patients.**

## Attentes vis-à-vis de Claude Code

### Périmètre
- Faire ce qui est demandé, rien de plus. Pas de fonctionnalité "bonus".
- Avant un changement structurel, proposer le plan et attendre validation.
- Signaler si une demande contredit ce fichier plutôt que l'appliquer en silence.
- Privilégier le code simple et lisible : ce prototype doit être **expliqué dans un
  mémoire** et défendu devant un jury.

### Vérification — règle stricte
- **Ne pas piloter mon interface graphique** : pas de capture d'écran, pas de `xdotool`,
  pas de clic simulé, pas d'interaction avec mon affichage X11.
- Me **donner les commandes de vérification**, je les exécute moi-même et je te renvoie
  la sortie. C'est moi qui valide, pas toi.
- Distinguer explicitement dans tout rapport :
  **ce que tu as réellement exécuté** vs **ce qui reste à vérifier de mon côté**.
- Ne jamais présenter une étape comme validée sur la seule foi de ton propre rapport.
- En cas d'anomalie ou de comportement inattendu : le signaler tel quel, sans inventer
  d'explication rassurante et sans en attribuer la cause à ma machine ou à moi.

### Honnêteté technique
- Si tu n'es pas certain d'un nom de paquet, d'une clé de configuration, d'une commande
  ou d'une option : **le dire au lieu de deviner**.
- Ne pas décrire mon environnement (OS, outils) par supposition : le constater ou se taire.
- Si un contournement a été nécessaire pour faire marcher quelque chose, le dire
  explicitement et préciser s'il a été intégré aux fichiers livrés ou non.

### Économie de contexte
- Réponses de synthèse courtes : pas de re-listing de fichiers déjà connus,
  pas de récapitulatif de ce que je viens de lire.
- Ne pas relire des fichiers déjà lus dans la session sauf s'ils ont changé.