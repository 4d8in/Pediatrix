// Un patient décédé ne peut plus être admis, hospitalisé, consulté ni recevoir de rendez-vous.
export function isDeceased(patient: { deceasedDateTime?: string; deceasedBoolean?: boolean } | null | undefined): boolean {
  return Boolean(patient?.deceasedDateTime || patient?.deceasedBoolean);
}

export const DECEASED_MESSAGE = "Ce patient est enregistré comme décédé.";
