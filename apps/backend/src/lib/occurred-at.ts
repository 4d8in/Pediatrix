// Horodatage d'une action saisie hors ligne : le poste envoie l'heure réelle de la saisie
// (`occurredAt`) pour que le dossier ne porte pas l'heure du renvoi. Bornes : pas dans le
// futur (tolérance d'horloge de 2 minutes) et pas plus vieux que 7 jours.
const MAX_AGE_MS = 7 * 86_400_000;
const FUTURE_TOLERANCE_MS = 2 * 60_000;

export function parseOccurredAt(raw: unknown, now: Date = new Date()): { at?: string } | { error: string } {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
    return { error: "L'heure de saisie (occurredAt) est invalide." };
  }
  const t = Date.parse(raw);
  if (t > now.getTime() + FUTURE_TOLERANCE_MS) return { error: "L'heure de saisie ne peut pas être dans le futur." };
  if (t < now.getTime() - MAX_AGE_MS) return { error: "L'heure de saisie date de plus de 7 jours." };
  return { at: new Date(t).toISOString() };
}
