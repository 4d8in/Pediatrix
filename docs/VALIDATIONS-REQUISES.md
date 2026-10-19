# Validations requises avant tout usage clinique réel

Pédiatrix contient des listes, seuils et règles médicales **écrites de mémoire** d'après des références publiques (OMS, standards ouverts). Elles n'ont **pas** été validées par des professionnels de santé. Aucune ne doit être utilisée sur de vrais patients avant la validation indiquée. Ce document est la liste unique de ces validations.

| Domaine | Fichier(s) | Ce qui doit être validé | Par qui |
|---|---|---|---|
| Formulaire pharmaceutique | `apps/backend/src/lib/formulary.ts` | Liste des articles, formes, unités, seuils de réapprovisionnement | Pharmacien responsable |
| Doses maximales et contre-indications | `apps/backend/src/lib/dose-rules.ts` | mg/kg/jour, plafonds absolus, âge/poids minimaux (paracétamol, ibuprofène, amoxicilline, gentamicine…) ; **pas d'interactions médicamenteuses** | Pharmacien + pédiatre |
| Échéancier des doses | `apps/backend/src/lib/administration-schedule.ts` | Intervalle régulier 24 h / N prises, délai de grâce du retard | Cadre infirmier / pédiatre |
| Constantes de tri | `apps/backend/src/lib/triage-vitals.ts` | Seuils critiques (SpO₂ < 90 %, température ≥ 39,5 °C ou < 35,5 °C), non ajustés à l'âge | Pédiatre |
| Intervalles de référence du laboratoire | `apps/backend/src/lib/lab-reference-ranges.ts`, `lab-catalog.ts` | Bornes par âge et sexe, seuils critiques, unités, catalogue d'examens | Biologiste responsable |
| Diagnostics CIM-10 proposés | `apps/backend/src/lib/diagnoses.ts` | Liste des diagnostics courants et codes | Pédiatre / DIM |
| Surveillance épidémiologique (IDSR) | `apps/backend/src/lib/idsr.ts` | Maladies à déclaration immédiate / hebdomadaire, préfixes CIM-10, seuil d'alerte (≥ 5 cas et ≥ 2× la moyenne) | Ministère de la santé / district |
| Calendrier vaccinal | `apps/backend/src/lib/vaccines.ts` | Doses, âges, intervalles du PEV du pays | Programme élargi de vaccination |
| Nutrition | `apps/backend/src/lib/nutrition.ts`, `growth-codes.ts` | Classement du périmètre brachial (115/125 mm, 6–59 mois) ; **courbes OMS (z-scores) absentes** | Nutritionniste |
| Naissance | `apps/backend/src/lib/birth.ts` | Alertes poids < 2500 g / < 1500 g, prématurité < 37 semaines, Apgar à 5 min < 7 | Pédiatre néonatologue |
| PTME (nourrisson exposé au VIH) | `apps/backend/src/lib/pmtct.ts` | Jalons (PCR 6 semaines, 9 mois, sérologie 18 mois), délais, fin de suivi | Programme national de lutte contre le VIH |
| Tarifs | `apps/backend/src/lib/tariffs.ts` | Grille des actes et médicaments | Direction / comptabilité |

## Autres validations non médicales

- **Licence** : `LICENSE` est un projet de licence propriétaire à faire relire par un juriste.
- **Traductions** : l'anglais (`apps/desktop/src/lib/i18n/en/`) doit être relu par un locuteur natif ; la liste des langues locales est à définir.
- **Conformité** : protection des données de santé (loi applicable, déclaration à l'autorité, hébergement, durées de conservation), statut de dispositif médical logiciel : à faire évaluer par un juriste local. Rien de cela n'a été évalué.
- **Sécurité en production** : voir [ADMINISTRATION.md](ADMINISTRATION.md) (TLS, signature des mises à jour, comptes de démonstration, sauvegardes chiffrées).

## Ce qui n'a pas été exécuté
Installation réelle sous Windows, chiffrement de la file hors ligne dans le processus principal d'Electron, mise à jour automatique, impression sur imprimante réelle, restauration d'une sauvegarde, import DHIS2 dans une instance réelle, test du profil TLS (Caddy), essai de montée en charge au-delà de quelques centaines d'arrivées par jour.
