import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Résultats déjà lus, par praticien : { [practitionerId]: [diagnosticReportId, ...] }.
// Fichier local (data/, non versionné) : c'est un état d'interface propre à chaque
// utilisateur, pas une donnée clinique — il n'a pas sa place dans HAPI.
const READS_FILE = fileURLToPath(new URL("../../data/report-reads.json", import.meta.url));

type ReadStore = Record<string, string[]>;

async function readStore(): Promise<ReadStore> {
  try {
    return JSON.parse(await readFile(READS_FILE, "utf-8")) as ReadStore;
  } catch {
    return {};
  }
}

export async function getReadReportIds(practitionerId: string): Promise<Set<string>> {
  const store = await readStore();
  return new Set(store[practitionerId] ?? []);
}

export async function markReportRead(practitionerId: string, reportId: string): Promise<void> {
  const store = await readStore();
  const ids = new Set(store[practitionerId] ?? []);
  ids.add(reportId);
  store[practitionerId] = [...ids];
  await mkdir(dirname(READS_FILE), { recursive: true });
  await writeFile(READS_FILE, JSON.stringify(store, null, 2));
}
