import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FORMULARY } from "./formulary.js";

// Grille tarifaire de l'établissement. Les montants par défaut sont des valeurs
// d'EXEMPLE pour la démonstration : chaque hôpital fixe les siens (écran
// Facturation, réservé à la direction), enregistrés dans data/tariffs.json.
const TARIFFS_FILE = fileURLToPath(new URL("../../data/tariffs.json", import.meta.url));

export interface TariffTable {
  currency: string;
  consultation: number;
  // Examen de laboratoire : prix particulier par code LOINC, sinon prix par défaut.
  labDefault: number;
  labByCode: Record<string, number>;
  imagingDefault: number;
  // Prix unitaire de chaque article du formulaire (clé = code article).
  drugs: Record<string, number>;
  // Faux tant que la direction n'a pas enregistré sa propre grille.
  customized: boolean;
}

export function defaultTariffs(): TariffTable {
  return {
    currency: process.env.BILLING_CURRENCY ?? "XOF",
    consultation: 2000,
    labDefault: 3000,
    labByCode: {},
    imagingDefault: 10000,
    drugs: Object.fromEntries(FORMULARY.map((item) => [item.code, 500])),
    customized: false,
  };
}

function isAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// Valide une grille reçue du client ; renvoie les erreurs ou la grille nettoyée.
export function validateTariffs(raw: unknown): { tariffs: TariffTable } | { errors: string[] } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const base = defaultTariffs();
  const errors: string[] = [];

  if (!isAmount(b.consultation)) errors.push("Tarif de consultation invalide.");
  if (!isAmount(b.labDefault)) errors.push("Tarif d'examen de laboratoire par défaut invalide.");
  if (!isAmount(b.imagingDefault)) errors.push("Tarif d'imagerie par défaut invalide.");

  const drugs: Record<string, number> = { ...base.drugs };
  const rawDrugs = (b.drugs ?? {}) as Record<string, unknown>;
  for (const item of FORMULARY) {
    const price = rawDrugs[item.code];
    if (price === undefined) continue;
    if (!isAmount(price)) errors.push(`Prix invalide pour ${item.name}.`);
    else drugs[item.code] = price;
  }

  const labByCode: Record<string, number> = {};
  for (const [code, price] of Object.entries((b.labByCode ?? {}) as Record<string, unknown>)) {
    if (!isAmount(price)) errors.push(`Prix invalide pour l'examen ${code}.`);
    else labByCode[code] = price;
  }

  if (errors.length > 0) return { errors };
  return {
    tariffs: {
      currency: base.currency,
      consultation: b.consultation as number,
      labDefault: b.labDefault as number,
      labByCode,
      imagingDefault: b.imagingDefault as number,
      drugs,
      customized: true,
    },
  };
}

export async function loadTariffs(): Promise<TariffTable> {
  try {
    const saved = JSON.parse(await readFile(TARIFFS_FILE, "utf-8")) as Partial<TariffTable>;
    const base = defaultTariffs();
    return { ...base, ...saved, drugs: { ...base.drugs, ...saved.drugs }, customized: true };
  } catch {
    return defaultTariffs();
  }
}

export async function saveTariffs(tariffs: TariffTable): Promise<void> {
  await mkdir(dirname(TARIFFS_FILE), { recursive: true });
  await writeFile(TARIFFS_FILE, JSON.stringify(tariffs, null, 2));
}
