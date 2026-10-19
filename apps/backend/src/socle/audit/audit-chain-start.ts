import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Date de début de la chaîne d'audit : la vérification ne relit que les événements depuis cette date
// (le journal complet peut compter des milliers d'événements antérieurs au chaînage).
const FILE = fileURLToPath(new URL("../../../data/audit-chain.json", import.meta.url));

export async function readChainStart(): Promise<string | null> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf-8")) as { startedAt?: string };
    return typeof parsed.startedAt === "string" ? parsed.startedAt : null;
  } catch {
    return null;
  }
}

export async function writeChainStart(startedAt: string): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify({ startedAt }), { mode: 0o600 });
}
