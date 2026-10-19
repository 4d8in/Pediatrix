import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Anti-doublon pour les envois différés du poste (file d'attente hors ligne) : un envoi peut
// avoir réussi côté serveur sans que le poste ait reçu la réponse. Le poste rejoue alors la même
// requête avec la même clé `Idempotency-Key` ; le serveur renvoie la réponse déjà produite sans
// rien réécrire. Clé propre à chaque utilisateur, liée à l'empreinte de la requête (méthode,
// adresse, corps), conservée 7 jours (data/, non versionné).
const FILE = fileURLToPath(new URL("../../data/idempotency.json", import.meta.url));
const TTL_MS = 7 * 86_400_000;
export const KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export interface StoredResponse {
  status: number;
  body: string;
  at: number;
  // Empreinte de la requête d'origine : une même clé pour une autre requête est une erreur.
  fingerprint: string;
}

export function fingerprintOf(method: string, url: string, body: unknown): string {
  // L'heure déclarée (occurredAt) n'est ajoutée qu'au renvoi : elle ne fait pas partie de l'empreinte.
  const content =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([k]) => k !== "occurredAt"))
      : body;
  return createHash("sha256").update(`${method} ${url} ${JSON.stringify(content ?? null)}`).digest("hex");
}

export class IdempotencyStore {
  private loading: Promise<Map<string, StoredResponse>> | null = null;
  private readonly inFlight = new Set<string>();
  // Écritures sérialisées : jamais deux écritures du fichier en même temps.
  private writeChain: Promise<void> = Promise.resolve();
  private counter = 0;

  constructor(private readonly file: string = FILE) {}

  // Un seul chargement, partagé par tous les appels simultanés.
  private load(): Promise<Map<string, StoredResponse>> {
    this.loading ??= this.readFromDisk();
    return this.loading;
  }

  private async readFromDisk(): Promise<Map<string, StoredResponse>> {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf-8")) as Record<string, StoredResponse>;
      return new Map(Object.entries(parsed));
    } catch (error) {
      // Fichier illisible (et non simplement absent) : on le met de côté au lieu de l'écraser en silence.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await rename(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => undefined);
        console.error("idempotency: fichier illisible, mis de côté (.corrupt-*).");
      }
      return new Map();
    }
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

  async save(scope: string, key: string, status: number, body: string, fingerprint: string, now: number = Date.now()): Promise<void> {
    const entries = await this.load();
    entries.set(`${scope}:${key}`, { status, body, at: now, fingerprint });
    this.inFlight.delete(`${scope}:${key}`);
    for (const [k, v] of entries) if (now - v.at >= TTL_MS) entries.delete(k);
    const snapshot = JSON.stringify(Object.fromEntries(entries));
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.${(this.counter += 1)}.tmp`;
      await writeFile(tmp, snapshot, { mode: 0o600 });
      await rename(tmp, this.file);
    });
    await this.writeChain;
  }
}

export const idempotencyStore = new IdempotencyStore();
