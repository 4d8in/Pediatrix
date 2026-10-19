// Arbitrages quand une même clé française a reçu plusieurs traductions dans des zones différentes
// (le français sert de clé : un mot ambigu n'a qu'une traduction). Appliqué en dernier.
const overrides: Record<string, string> = {
  Nom: "Name",
  Identifiant: "Username",
  Résultat: "Result",
  Examen: "Test",
  "Examen non précisé": "Test not specified",
  Hospitalisations: "Hospitalizations",
  Vaccinations: "Vaccinations",
  "Carnet vaccinal": "Vaccination record",
  "Dossier patient": "Patient record",
  Supervision: "Supervision",
  "Journal d'audit": "Audit log",
  Connexion: "Sign in",
  Demandeur: "Requested by",
  "Né(e) le": "Born on",
  "Ex. : 3": "e.g. 3",
  "Le serveur Pédiatrix est injoignable.": "The Pédiatrix server is unreachable.",
};

export default overrides;
