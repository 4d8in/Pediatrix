// Les identifiants reçus dans l'URL ou la requête sont insérés dans des adresses
// envoyées à HAPI (`/Patient/${id}`, `?patient=${id}`). Un identifiant contenant
// « ? », « & » ou « / » pourrait détourner la recherche : on n'accepte donc que des
// identifiants simples (lettres, chiffres, point, tiret, soulignement).
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

// Paramètres d'URL dont le contenu n'est pas un identifiant FHIR (nom de fichier de
// mise à jour : contrôlé par sa propre liste blanche dans updates.route.ts).
const EXEMPT_PARAMS = new Set(["file"]);

export function findUnsafeParam(params: unknown): string | undefined {
  for (const [name, value] of Object.entries((params ?? {}) as Record<string, unknown>)) {
    if (EXEMPT_PARAMS.has(name)) continue;
    if (!isSafeId(value)) return name;
  }
  return undefined;
}
