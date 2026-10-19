import { hapiClient } from "./hapi-client.js";

interface Bundle<T> {
  entry?: { resource: T }[];
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

// Lit toutes les pages d'une recherche (HAPI limite la taille d'une page).
// `path` ne doit pas contenir _count/_offset. Cohérence immédiate : pas de cache.
export async function fetchAll<T>(path: string): Promise<T[]> {
  const all: T[] = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const bundle = await hapiClient.get<Bundle<T>>(
      `${path}${separator}_count=${PAGE_SIZE}&_offset=${page * PAGE_SIZE}`,
      { "Cache-Control": "no-cache" },
    );
    const resources = (bundle.entry ?? []).map((entry) => entry.resource);
    all.push(...resources);
    if (resources.length < PAGE_SIZE) break;
  }
  return all;
}

// Comme fetchAll, mais renvoie un Bundle déjà assemblé : les analyseurs de listes existants (qui lisent
// `bundle.entry`) fonctionnent sans changement, et la liste n'est plus tronquée à la taille de page de HAPI.
export async function fetchBundle<B extends { entry?: { resource: unknown }[] }>(path: string): Promise<B> {
  const resources = await fetchAll<unknown>(path);
  return { resourceType: "Bundle", type: "searchset", entry: resources.map((resource) => ({ resource })) } as unknown as B;
}
