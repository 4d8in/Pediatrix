// Limite les essais de connexion : après MAX_FAILURES échecs pour un même
// couple (adresse, identifiant), la connexion est refusée pendant LOCK_MS.
// En mémoire : se remet à zéro au redémarrage du backend, ce qui suffit contre
// une devinette de mot de passe sans ajouter de dépendance.
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;

interface Entry {
  failures: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();

  // Secondes à attendre avant de pouvoir réessayer (0 = autorisé).
  retryAfterSeconds(key: string, now: number = Date.now()): number {
    const entry = this.entries.get(key);
    if (!entry || entry.lockedUntil <= now) return 0;
    return Math.ceil((entry.lockedUntil - now) / 1000);
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const previous = this.entries.get(key);
    // Un verrou expiré repart de zéro.
    const failures = previous && previous.lockedUntil > 0 && previous.lockedUntil <= now ? 1 : (previous?.failures ?? 0) + 1;
    this.entries.set(key, { failures, lockedUntil: failures >= MAX_FAILURES ? now + LOCK_MS : 0 });
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}

export const loginThrottle = new LoginThrottle();
