import { useSyncExternalStore } from "react";

// File d'attente des envois différés : quand le serveur est injoignable (coupure réseau ou
// électrique côté serveur), certaines saisies sûres sont gardées sur le poste puis renvoyées
// au retour de la connexion. Seules des écritures qui s'ajoutent à un dossier EXISTANT et dont le
// renvoi ne crée pas de conflit y passent (voir api.ts : arrivée, tri, croissance, vaccin,
// allergie). Jamais d'argent, de stock ni de prescription.
// Chaque envoi porte une clé d'idempotence : si la requête avait en fait abouti, le serveur ne
// l'enregistre pas deux fois. Les éléments sont liés à l'utilisateur qui les a saisis, et ne
// partent que lorsque cet utilisateur est connecté (la trace d'audit lui reste attribuée).

export interface OutboxItem {
  // Clé d'idempotence, aussi identifiant de l'élément.
  id: string;
  userId: string;
  path: string;
  body: Record<string, unknown>;
  // Libellé lisible pour l'utilisateur (en français, traduit à l'affichage).
  label: string;
  createdAt: string;
}

export interface FailedItem extends OutboxItem {
  error: string;
}

interface OutboxState {
  items: OutboxItem[];
  failed: FailedItem[];
  // Faux si le poste ne peut pas chiffrer le contenu : la file reste alors en mémoire seulement.
  persistent: boolean;
}

// Pont Electron (voir electron/preload.ts) : contenu chiffré avec le coffre du système.
interface OutboxBridge {
  load(): Promise<string | null>;
  save(json: string): Promise<boolean>;
}

declare global {
  interface Window {
    pediatrixOutbox?: OutboxBridge;
  }
}

let state: OutboxState = { items: [], failed: [], persistent: false };
const listeners = new Set<() => void>();
let currentUserId: string | null = null;
let loaded = false;
let isReplaying = false;

function emit(next: OutboxState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

async function persist(): Promise<void> {
  const bridge = window.pediatrixOutbox;
  if (!bridge) return;
  try {
    const ok = await bridge.save(JSON.stringify({ items: state.items, failed: state.failed }));
    if (ok !== state.persistent) emit({ ...state, persistent: ok });
  } catch {
    emit({ ...state, persistent: false });
  }
}

export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const bridge = window.pediatrixOutbox;
  if (!bridge) return;
  try {
    const raw = await bridge.load();
    if (raw) {
      const parsed = JSON.parse(raw) as { items?: OutboxItem[]; failed?: FailedItem[] };
      emit({ items: parsed.items ?? [], failed: parsed.failed ?? [], persistent: true });
    } else {
      emit({ ...state, persistent: true });
    }
  } catch {
    // contenu illisible : on repart d'une file vide plutôt que de bloquer l'application
  }
}

export function setOutboxUser(userId: string | null): void {
  currentUserId = userId;
  if (userId) void loadOutbox();
}

export async function enqueue(item: Omit<OutboxItem, "createdAt" | "userId">): Promise<void> {
  if (!currentUserId) throw new Error("Aucun utilisateur connecté.");
  await loadOutbox();
  emit({ ...state, items: [...state.items, { ...item, userId: currentUserId, createdAt: new Date().toISOString() }] });
  await persist();
}

export function dismissFailed(id: string): void {
  emit({ ...state, failed: state.failed.filter((item) => item.id !== id) });
  void persist();
}

export type ReplaySender = (item: OutboxItem) => Promise<void>;
export type ReplayClassifier = (error: unknown) => "network" | "unauthorized" | "duplicate" | "rejected" | "retry";

// Renvoie dans l'ordre les éléments de l'utilisateur connecté. S'arrête au premier échec
// réseau ou serveur (on réessaiera) ; un refus définitif (donnée invalide, patient disparu)
// passe dans « à vérifier » avec le message du serveur, il n'est jamais perdu en silence.
export async function replayOutbox(send: ReplaySender, classify: ReplayClassifier): Promise<{ sent: number }> {
  if (isReplaying || !currentUserId) return { sent: 0 };
  isReplaying = true;
  let sent = 0;
  try {
    for (const item of state.items.filter((i) => i.userId === currentUserId)) {
      try {
        await send(item);
        sent += 1;
        emit({ ...state, items: state.items.filter((i) => i.id !== item.id) });
        await persist();
      } catch (error) {
        const kind = classify(error);
        if (kind === "duplicate") {
          emit({ ...state, items: state.items.filter((i) => i.id !== item.id) });
          await persist();
          continue;
        }
        if (kind === "rejected") {
          const message = error instanceof Error ? error.message : "Refusé par le serveur.";
          emit({ ...state, items: state.items.filter((i) => i.id !== item.id), failed: [...state.failed, { ...item, error: message }] });
          await persist();
          continue;
        }
        break; // réseau, session expirée ou erreur serveur : on s'arrête, on réessaiera
      }
    }
  } finally {
    isReplaying = false;
  }
  return { sent };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOutbox(): OutboxState & { mine: OutboxItem[] } {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return { ...snapshot, mine: snapshot.items.filter((item) => item.userId === currentUserId) };
}

// Réservé aux tests.
export function __resetOutboxForTests(): void {
  state = { items: [], failed: [], persistent: false };
  currentUserId = null;
  loaded = false;
  isReplaying = false;
}
