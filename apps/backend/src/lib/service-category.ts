// Discrimine, au sein du même serveur HAPI, les ServiceRequest/DiagnosticReport
// du module Radiologie de ceux du module Laboratoire. Sans ce champ, une
// recherche sans filtre (ex. list-lab-requests.route.ts) verrait aussi les
// ressources de l'autre module.
export const SERVICE_CATEGORY_SYSTEM = "http://pediatrix.local/fhir/service-category";
export const IMAGING_CATEGORY_CODE = "imaging";

export const IMAGING_CATEGORY_CODING = {
  system: SERVICE_CATEGORY_SYSTEM,
  code: IMAGING_CATEGORY_CODE,
  display: "Imagerie",
};

// Utilisé avec le modificateur de recherche FHIR `:not` : les ressources sans
// `category` (ex. les ServiceRequest labo existants) satisfont "not equal",
// donc restent visibles côté labo sans migration de données.
export const IMAGING_CATEGORY_SEARCH_TOKEN = `${SERVICE_CATEGORY_SYSTEM}|${IMAGING_CATEGORY_CODE}`;
