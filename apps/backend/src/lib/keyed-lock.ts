// Sérialise les opérations portant sur une même clé (facture, ordonnance, article).
// Le backend tourne en un seul processus : un verrou en mémoire suffit à éviter
// le double encaissement ou la double délivrance par deux requêtes simultanées.
const tails = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
}
