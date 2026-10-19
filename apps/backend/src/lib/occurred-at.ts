// Horodatage d'une action saisie hors ligne : le poste envoie l'heure réelle de la saisie
// (`occurredAt`) quand l'envoi a dû être différé. Bornes : pas plus vieux que 24 h ; un futur
// proche (horloge du poste en avance, jusqu'à 10 minutes) est ramené à l'instant présent plutôt
// que refusé, au-delà c'est une erreur. L'heure de réception du serveur reste la référence de
// la file du jour (voir lib/arrival.ts) ; l'heure déclarée est conservée en plus.
const MAX_AGE_MS = 24 * 3_600_000;
const FUTURE_TOLERANCE_MS = 10 * 60_000;

export function parseOccurredAt(raw: unknown, now: Date = new Date()): { at?: string } | { error: string } {
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
    return { error: "L'heure de saisie (occurredAt) est invalide." };
  }
  const t = Date.parse(raw);
  if (t > now.getTime() + FUTURE_TOLERANCE_MS) return { error: "L'heure de saisie est trop loin dans le futur : vérifiez l'horloge du poste." };
  if (t > now.getTime()) return { at: now.toISOString() };
  if (t < now.getTime() - MAX_AGE_MS) return { error: "L'heure de saisie date de plus de 24 heures." };
  return { at: new Date(t).toISOString() };
}
