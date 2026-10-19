// Suivi du nourrisson exposé au VIH (PTME : prévention de la transmission mère-enfant).
// Calendrier de dépistage inspiré des recommandations publiques de l'OMS, écrit de mémoire et À FAIRE
// VALIDER par le programme national (les jalons et délais diffèrent selon les pays) :
//   - test virologique (PCR) vers 6 semaines ; - second contrôle vers 9 mois ; - sérologie finale à 18 mois.
// Le cotrimoxazole est habituellement débuté dès 6 semaines jusqu'à exclusion de l'infection.
export const PMTCT_CATEGORY_SYSTEM = "http://pediatrix.local/fhir/observation-category";
export const PMTCT_CATEGORY_CODE = "pmtct";
export const PMTCT_CATEGORY_SEARCH_TOKEN = `${PMTCT_CATEGORY_SYSTEM}|${PMTCT_CATEGORY_CODE}`;
export const PMTCT_CODE_SYSTEM = "http://pediatrix.local/fhir/pmtct";

export const MILESTONES = [
  { key: "pcr_6w", label: "Test virologique (PCR) à 6 semaines", dueDays: 42 },
  { key: "pcr_9m", label: "Contrôle à 9 mois", dueDays: 274 },
  { key: "sero_18m", label: "Sérologie finale à 18 mois", dueDays: 548 },
] as const;
export type MilestoneKey = (typeof MILESTONES)[number]["key"];

// Un jalon dû depuis plus de ce délai est « en retard ».
export const OVERDUE_AFTER_DAYS = 28;

export const MOTHER_STATUSES = ["on_art", "not_on_art", "unknown"] as const;
export type MotherStatus = (typeof MOTHER_STATUSES)[number];

export interface Enrolment {
  motherStatus: MotherStatus;
  infantProphylaxis: boolean;
}

export interface TestResult {
  milestone: MilestoneKey;
  result: "negative" | "positive";
  date: string;
}

export type MilestoneState = "done" | "upcoming" | "due" | "overdue";

export interface MilestoneStatus {
  key: MilestoneKey;
  label: string;
  dueDate: string;
  state: MilestoneState;
  result: "negative" | "positive" | null;
}

export type FollowUpStatus = "in_follow_up" | "positive" | "cleared";

export function isMilestone(value: unknown): value is MilestoneKey {
  return typeof value === "string" && MILESTONES.some((m) => m.key === value);
}

export function validateEnrolment(body: unknown): { input: Enrolment } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof b.motherStatus !== "string" || !(MOTHER_STATUSES as readonly string[]).includes(b.motherStatus)) {
    errors.push("Le statut de la mère (sous ARV, sans ARV, inconnu) est requis.");
  }
  if (typeof b.infantProphylaxis !== "boolean") errors.push("Indiquer si le nourrisson a reçu la prophylaxie ARV.");
  if (errors.length > 0) return { errors };
  return { input: { motherStatus: b.motherStatus as MotherStatus, infantProphylaxis: b.infantProphylaxis as boolean } };
}

export function validateTest(body: unknown): { input: { milestone: MilestoneKey; result: "negative" | "positive" } } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  if (!isMilestone(b.milestone)) errors.push("Jalon de dépistage invalide.");
  if (b.result !== "negative" && b.result !== "positive") errors.push("Le résultat doit être « negative » ou « positive ».");
  if (errors.length > 0) return { errors };
  return { input: { milestone: b.milestone as MilestoneKey, result: b.result as "negative" | "positive" } };
}

// Un résultat n'est accepté que dans les 14 jours précédant l'échéance du jalon (ou après) : un test fait
// bien avant n'est pas le test du calendrier. Renvoie un message d'erreur, ou null si c'est possible.
export const EARLY_WINDOW_DAYS = 14;
export function milestoneTooEarly(birthDate: string, milestone: MilestoneKey, now: Date = new Date()): string | null {
  const birth = Date.parse(birthDate);
  if (!/^\d{4}-\d{2}-\d{2}/.test(birthDate) || Number.isNaN(birth)) return "Date de naissance absente ou invalide : le calendrier PTME ne peut pas être calculé.";
  const def = MILESTONES.find((m) => m.key === milestone)!;
  const earliest = birth + (def.dueDays - EARLY_WINDOW_DAYS) * 86_400_000;
  return now.getTime() < earliest ? "Ce jalon n'est pas encore échu : le résultat ne peut pas être enregistré avant l'échéance." : null;
}

export function followUp(birthDate: string, results: TestResult[], now: Date = new Date()): { status: FollowUpStatus; milestones: MilestoneStatus[] } {
  const birth = Date.parse(birthDate);
  const milestones: MilestoneStatus[] = MILESTONES.map((m) => {
    const done = results.find((r) => r.milestone === m.key);
    const due = Number.isNaN(birth) ? Number.NaN : birth + m.dueDays * 86_400_000;
    let state: MilestoneState = "upcoming";
    if (done) state = "done";
    else if (!Number.isNaN(due) && now.getTime() >= due + OVERDUE_AFTER_DAYS * 86_400_000) state = "overdue";
    else if (!Number.isNaN(due) && now.getTime() >= due) state = "due";
    return {
      key: m.key,
      label: m.label,
      dueDate: Number.isNaN(due) ? "" : new Date(due).toISOString().slice(0, 10),
      state,
      result: done?.result ?? null,
    };
  });
  // Fin de suivi seulement si la sérologie finale est négative ET que le premier dépistage a été fait.
  const status: FollowUpStatus = results.some((r) => r.result === "positive")
    ? "positive"
    : results.some((r) => r.milestone === "sero_18m" && r.result === "negative") && results.some((r) => r.milestone === "pcr_6w")
      ? "cleared"
      : "in_follow_up";
  return { status, milestones };
}
