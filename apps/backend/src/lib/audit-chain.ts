import { createHash } from "node:crypto";

// Chaînage du journal d'audit : chaque événement porte un numéro de séquence et l'empreinte SHA-256 de son
// contenu liée à l'empreinte de l'événement précédent. Modifier ou supprimer un ancien événement casse la
// chaîne, ce que GET /api/audit/verify détecte (un attaquant qui réécrit TOUT le journal reste possible :
// exporter régulièrement l'empreinte la plus récente vers un support externe).
export const AUDIT_SEQ_URL = "http://pediatrix.local/fhir/audit-seq";
export const AUDIT_HASH_URL = "http://pediatrix.local/fhir/audit-hash";
export const GENESIS_HASH = "0".repeat(64);

type Json = Record<string, unknown>;

// Seuls les champs écrits par toAuditEvent comptent : HAPI ajoute id, meta, text… qui ne doivent pas changer l'empreinte.
const SIGNED_FIELDS = ["resourceType", "type", "action", "recorded", "outcome", "agent", "source", "entity", "outcomeDesc"];

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Json;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function eventHash(previousHash: string, seq: number, event: Json): string {
  const signed: Json = {};
  for (const field of SIGNED_FIELDS) signed[field] = event[field];
  return createHash("sha256").update(`${previousHash}|${seq}|${canonical(signed)}`).digest("hex");
}

export function withChain(event: Json, previous: { seq: number; hash: string }): { event: Json; seq: number; hash: string } {
  const seq = previous.seq + 1;
  const hash = eventHash(previous.hash, seq, event);
  return {
    event: {
      ...event,
      extension: [
        { url: AUDIT_SEQ_URL, valueInteger: seq },
        { url: AUDIT_HASH_URL, valueString: hash },
      ],
    },
    seq,
    hash,
  };
}

export function readChain(event: Json): { seq: number; hash: string } | null {
  const extensions = (event.extension as { url?: string; valueInteger?: number; valueString?: string }[] | undefined) ?? [];
  const seq = extensions.find((e) => e.url === AUDIT_SEQ_URL)?.valueInteger;
  const hash = extensions.find((e) => e.url === AUDIT_HASH_URL)?.valueString;
  return typeof seq === "number" && typeof hash === "string" ? { seq, hash } : null;
}

export interface ChainReport {
  verified: number;
  legacy: number;
  ok: boolean;
  brokenAtSeq: number | null;
  reason: string | null;
  lastSeq: number;
  lastHash: string;
}

// `events` : tous les événements d'audit, dans n'importe quel ordre.
export function verifyChain(events: Json[]): ChainReport {
  const chained = events
    .map((event) => ({ event, chain: readChain(event) }))
    .filter((item): item is { event: Json; chain: { seq: number; hash: string } } => item.chain !== null)
    .sort((a, b) => a.chain.seq - b.chain.seq);
  const legacy = events.length - chained.length;
  let previous = { seq: 0, hash: GENESIS_HASH };
  const report: ChainReport = { verified: 0, legacy, ok: true, brokenAtSeq: null, reason: null, lastSeq: 0, lastHash: GENESIS_HASH };
  for (const { event, chain } of chained) {
    if (chain.seq !== previous.seq + 1) {
      return { ...report, ok: false, brokenAtSeq: chain.seq, reason: `Événement manquant avant la séquence ${chain.seq} (attendu ${previous.seq + 1}).` };
    }
    if (eventHash(previous.hash, chain.seq, event) !== chain.hash) {
      return { ...report, ok: false, brokenAtSeq: chain.seq, reason: `Contenu modifié à la séquence ${chain.seq}.` };
    }
    previous = chain;
    report.verified += 1;
    report.lastSeq = chain.seq;
    report.lastHash = chain.hash;
  }
  return report;
}
