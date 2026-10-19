// Prochaine prise d'un médicament prescrit à N prises par jour : intervalle régulier de 24 h / N à partir
// de la dernière prise DONNÉE (une prise « non donnée » ne repousse pas l'échéance : il faut la rattraper).
// Sans prise donnée, la première est due dès l'ordonnance ou l'admission. Repère simple, à valider.
export type DoseState = "not_due" | "due" | "overdue";

export interface DoseSchedule {
  nextDueAt: string;
  state: DoseState;
}

const MIN_GRACE_MS = 30 * 60_000;

export function doseSchedule(args: { dosesPerDay: number; lastGivenAt: string | null; anchor: string; now?: Date }): DoseSchedule | null {
  const { dosesPerDay, lastGivenAt, anchor } = args;
  if (!Number.isInteger(dosesPerDay) || dosesPerDay < 1 || dosesPerDay > 24) return null;
  const intervalMs = (24 * 3_600_000) / dosesPerDay;
  const base = Date.parse(lastGivenAt ?? anchor);
  if (Number.isNaN(base)) return null;
  const due = lastGivenAt ? base + intervalMs : base;
  const now = (args.now ?? new Date()).getTime();
  const grace = Math.max(MIN_GRACE_MS, intervalMs / 4);
  const state: DoseState = now >= due + grace ? "overdue" : now >= due ? "due" : "not_due";
  return { nextDueAt: new Date(due).toISOString(), state };
}
