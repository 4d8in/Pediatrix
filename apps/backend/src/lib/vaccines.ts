import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Vaccins du programme élargi de vaccination (PEV) et calendrier de rappel.
// Le calendrier ci-dessous est un EXEMPLE fondé sur le PEV standard de l'Afrique de
// l'Ouest : chaque pays publie le sien. Pour adopter le calendrier national en vigueur,
// déposer data/vaccine-schedule.json (même format) : il remplace celui-ci sans toucher au code.
export const VACCINE_SYSTEM = "http://pediatrix.local/fhir/vaccine";
const SCHEDULE_FILE = fileURLToPath(new URL("../../data/vaccine-schedule.json", import.meta.url));

export interface Vaccine {
  code: string;
  name: string;
}

export const VACCINES: Vaccine[] = [
  { code: "BCG", name: "BCG (tuberculose)" },
  { code: "VPO", name: "Polio oral (VPO)" },
  { code: "VPI", name: "Polio inactivé (VPI)" },
  { code: "PENTA", name: "Pentavalent (DTC-HepB-Hib)" },
  { code: "PCV13", name: "Pneumocoque (PCV13)" },
  { code: "ROTA", name: "Rotavirus" },
  { code: "RR", name: "Rougeole-Rubéole (RR)" },
  { code: "VAA", name: "Fièvre jaune (VAA)" },
];

export function findVaccine(code: string): Vaccine | undefined {
  return VACCINES.find((vaccine) => vaccine.code === code);
}

export interface ScheduleEntry {
  vaccine: string;
  dose: number;
  // Âge recommandé, en jours depuis la naissance.
  dueDays: number;
  label: string;
}

export const DEFAULT_SCHEDULE: ScheduleEntry[] = [
  { vaccine: "BCG", dose: 1, dueDays: 0, label: "Naissance" },
  { vaccine: "VPO", dose: 1, dueDays: 0, label: "Naissance" },
  { vaccine: "PENTA", dose: 1, dueDays: 42, label: "6 semaines" },
  { vaccine: "VPO", dose: 2, dueDays: 42, label: "6 semaines" },
  { vaccine: "PCV13", dose: 1, dueDays: 42, label: "6 semaines" },
  { vaccine: "ROTA", dose: 1, dueDays: 42, label: "6 semaines" },
  { vaccine: "PENTA", dose: 2, dueDays: 70, label: "10 semaines" },
  { vaccine: "VPO", dose: 3, dueDays: 70, label: "10 semaines" },
  { vaccine: "PCV13", dose: 2, dueDays: 70, label: "10 semaines" },
  { vaccine: "ROTA", dose: 2, dueDays: 70, label: "10 semaines" },
  { vaccine: "PENTA", dose: 3, dueDays: 98, label: "14 semaines" },
  { vaccine: "VPO", dose: 4, dueDays: 98, label: "14 semaines" },
  { vaccine: "PCV13", dose: 3, dueDays: 98, label: "14 semaines" },
  { vaccine: "VPI", dose: 1, dueDays: 98, label: "14 semaines" },
  { vaccine: "RR", dose: 1, dueDays: 270, label: "9 mois" },
  { vaccine: "VAA", dose: 1, dueDays: 270, label: "9 mois" },
  { vaccine: "RR", dose: 2, dueDays: 450, label: "15 mois" },
];

export async function loadSchedule(): Promise<ScheduleEntry[]> {
  try {
    const custom = JSON.parse(await readFile(SCHEDULE_FILE, "utf-8")) as ScheduleEntry[];
    const valid = custom.filter(
      (e) => findVaccine(e.vaccine) && Number.isInteger(e.dose) && e.dose > 0 && Number.isFinite(e.dueDays) && e.dueDays >= 0,
    );
    return valid.length > 0 ? valid : DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export type ScheduleStatus = "done" | "overdue" | "due" | "upcoming";

export interface ScheduleItem {
  vaccine: string;
  name: string;
  dose: number;
  label: string;
  dueDate: string;
  status: ScheduleStatus;
  doneDate: string | null;
}

// Au-delà de ce délai après la date prévue, la dose est « en retard ».
export const OVERDUE_GRACE_DAYS = 28;

const DAY_MS = 86_400_000;

export interface RecordedDose {
  code: string | null;
  date: string | null;
}

// Les doses déjà faites d'un vaccin comblent ses premières doses du calendrier, dans l'ordre :
// robuste même si le numéro de dose n'a pas été saisi.
export function computeSchedule(birthDate: string, recorded: RecordedDose[], schedule: ScheduleEntry[], today: Date): ScheduleItem[] {
  const birth = Date.parse(birthDate);
  if (Number.isNaN(birth)) return [];

  const byVaccine = new Map<string, string[]>();
  for (const dose of recorded) {
    if (!dose.code) continue;
    const dates = byVaccine.get(dose.code) ?? [];
    dates.push(dose.date ?? "");
    byVaccine.set(dose.code, dates);
  }
  for (const dates of byVaccine.values()) dates.sort();

  return [...schedule]
    .sort((a, b) => a.dueDays - b.dueDays || a.vaccine.localeCompare(b.vaccine) || a.dose - b.dose)
    .map((entry): ScheduleItem => {
      const dueTime = birth + entry.dueDays * DAY_MS;
      const dates = byVaccine.get(entry.vaccine) ?? [];
      const doneDate = dates[entry.dose - 1];
      const dueDate = new Date(dueTime).toISOString().slice(0, 10);
      const todayTime = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

      let status: ScheduleStatus;
      if (doneDate !== undefined) status = "done";
      else if (dueTime > todayTime) status = "upcoming";
      else if (todayTime - dueTime > OVERDUE_GRACE_DAYS * DAY_MS) status = "overdue";
      else status = "due";

      return {
        vaccine: entry.vaccine,
        name: findVaccine(entry.vaccine)?.name ?? entry.vaccine,
        dose: entry.dose,
        label: entry.label,
        dueDate,
        status,
        doneDate: doneDate !== undefined ? doneDate.slice(0, 10) || null : null,
      };
    });
}
