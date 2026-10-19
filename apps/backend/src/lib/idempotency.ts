import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Anti-doublon pour les envois différés du poste (file d'attente hors ligne) : un envoi peut
// avoir réussi côté serveur sans que le poste ait reçu la réponse. Le poste rejoue alors la même
// requête avec la même clé `Idempotency-Key` ; le serveur renvoie la réponse déjà produite sans
// rien réécrire. Clé propre à chaque utilisateur, conservée 7 jours (data/, non versionné).
const FILE = fileURLToPath(new URL("../../data/idempotency.json", import.meta.url));
const TTL_MS = 7 * 86_400_000;
export const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export interface StoredResponse {
  status: number;
  body: string;
  at: number;
}

export class IdempotencyStore {
  private entries: Map<string, StoredResponse> | null = null;
  private readonly inFlight = new Set<string>();

  constructor(private readonly file: string = FILE) {}

  private async load(): Promise<Map<string, StoredResponse>> {
    if (this.entries) return this.entries;
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf-8")) as Record<string, StoredResponse>;
      this.entries = new Map(Object.entries(parsed));
    } catch {
      this.entries = new Map();
    }
    return this.entries;
  }

  async get(scope: string, key: string, now: number = Date.now()): Promise<StoredResponse | undefined> {
    const entry = (await this.load()).get(`${scope}:${key}`);
    return entry && now - entry.at < TTL_MS ? entry : undefined;
  }

  // Marque la clé « en cours » ; faux si une requête identique est déjà en train d'être traitée.
  begin(scope: string, key: string): boolean {
    const id = `${scope}:${key}`;
    if (this.inFlight.has(id)) return false;
    this.inFlight.add(id);
    return true;
  }

  abort(scope: string, key: string): void {
    this.inFlight.delete(`${scope}:${key}`);
  }

  async save(scope: string, key: string, status: number, body: string, now: number = Date.now()): Promise<void> {
    const entries = await this.load();
    entries.set(`${scope}:${key}`, { status, body, at: now });
    this.inFlight.delete(`${scope}:${key}`);
    for (const [k, v] of entries) if (now - v.at >= TTL_MS) entries.delete(k);
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(Object.fromEntries(entries)), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}

export const idempotencyStore = new IdempotencyStore();
