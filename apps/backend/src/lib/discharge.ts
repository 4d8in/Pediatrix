// Issue d'une hospitalisation, saisie à la sortie du patient. Les codes HL7 (discharge-disposition)
// servent à l'interopérabilité ; l'issue précise (guéri / amélioré…) est gardée à part. Le décès
// alimente les indicateurs de mortalité hospitalière.
export const DISCHARGE_SYSTEM = "http://terminology.hl7.org/CodeSystem/discharge-disposition";
export const DISCHARGE_OUTCOME_URL = "http://pediatrix.local/fhir/discharge-outcome";
export const DISCHARGE_SUMMARY_URL = "http://pediatrix.local/fhir/discharge-summary";

export const DISCHARGE_CORRECTION_URL = "http://pediatrix.local/fhir/discharge-correction";

export const OUTCOMES = ["healed", "improved", "referred", "against_advice", "deceased"] as const;
export type DischargeOutcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<DischargeOutcome, string> = {
  healed: "Guéri",
  improved: "Amélioré",
  referred: "Référé vers une autre structure",
  against_advice: "Sortie contre avis médical",
  deceased: "Décédé",
};

const HL7_CODE: Record<DischargeOutcome, string> = {
  healed: "home",
  improved: "home",
  referred: "other-hcf",
  against_advice: "aadvice",
  deceased: "exp",
};

export function isOutcome(value: unknown): value is DischargeOutcome {
  return typeof value === "string" && (OUTCOMES as readonly string[]).includes(value);
}

export function validateDischarge(
  body: unknown,
): { outcome?: DischargeOutcome; summary?: string; deceasedAt?: string } | { errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  let outcome: DischargeOutcome | undefined;
  if (b.outcome !== undefined && b.outcome !== "") {
    if (isOutcome(b.outcome)) outcome = b.outcome;
    else errors.push("Issue de séjour invalide.");
  }
  const summary = typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : undefined;
  if (summary && summary.length > 2000) errors.push("Le résumé de sortie est trop long (2000 caractères maximum).");
  // Date et heure réelles du décès (facultatives : l'heure de saisie sert à défaut).
  let deceasedAt: string | undefined;
  if (b.deceasedAt !== undefined && b.deceasedAt !== "") {
    // Format ISO complet avec fuseau (Z ou ±hh:mm) exigé : pas d'ambiguïté d'heure locale.
    const time =
      typeof b.deceasedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(b.deceasedAt)
        ? Date.parse(b.deceasedAt)
        : Number.NaN;
    if (outcome !== "deceased") errors.push("La date du décès n'a de sens qu'avec l'issue « décédé ».");
    else if (Number.isNaN(time)) errors.push("Date du décès invalide.");
    else if (time > Date.now() + 10 * 60_000) errors.push("La date du décès ne peut pas être dans le futur.");
    else deceasedAt = new Date(time).toISOString();
  }
  if (errors.length > 0) return { errors };
  return { outcome, summary, ...(deceasedAt ? { deceasedAt } : {}) };
}

// Ajoute l'issue et le résumé à la ressource Encounter du séjour (le reste est préservé pour le PUT).
export function withDischarge(stay: Record<string, unknown>, outcome?: DischargeOutcome, summary?: string): Record<string, unknown> {
  const extension = [
    ...(((stay.extension as { url: string }[] | undefined) ?? []).filter(
      (e) => e.url !== DISCHARGE_OUTCOME_URL && e.url !== DISCHARGE_SUMMARY_URL,
    )),
    ...(outcome ? [{ url: DISCHARGE_OUTCOME_URL, valueCode: outcome }] : []),
    ...(summary ? [{ url: DISCHARGE_SUMMARY_URL, valueString: summary }] : []),
  ];
  return {
    ...stay,
    extension: extension.length > 0 ? extension : undefined,
    hospitalization: outcome
      ? {
          ...((stay.hospitalization as object | undefined) ?? {}),
          dischargeDisposition: {
            coding: [{ system: DISCHARGE_SYSTEM, code: HL7_CODE[outcome] }],
            text: OUTCOME_LABELS[outcome],
          },
        }
      : stay.hospitalization,
  };
}

export function readDischarge(stay: { extension?: { url: string; valueCode?: string; valueString?: string }[] }): {
  outcome: DischargeOutcome | null;
  summary: string | null;
} {
  const outcome = stay.extension?.find((e) => e.url === DISCHARGE_OUTCOME_URL)?.valueCode;
  return {
    outcome: isOutcome(outcome) ? outcome : null,
    summary: stay.extension?.find((e) => e.url === DISCHARGE_SUMMARY_URL)?.valueString ?? null,
  };
}

// Annule l'issue « décédé » d'un séjour (erreur de saisie corrigée par un médecin) : l'issue et le code
// de sortie sont retirés et la correction est tracée dans le séjour.
export function withoutDeath(stay: Record<string, unknown>, note: string): Record<string, unknown> {
  const extension = [
    ...(((stay.extension as { url: string }[] | undefined) ?? []).filter((e) => e.url !== DISCHARGE_OUTCOME_URL)),
    { url: DISCHARGE_CORRECTION_URL, valueString: note },
  ];
  const { dischargeDisposition: _removed, ...hospitalization } = (stay.hospitalization as Record<string, unknown> | undefined) ?? {};
  return { ...stay, extension, hospitalization: Object.keys(hospitalization).length > 0 ? hospitalization : undefined };
}
