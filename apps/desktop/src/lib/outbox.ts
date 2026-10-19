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
  // Échecs serveur déjà essuyés (voir MAX_ATTEMPTS).
  attempts: number;
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
let isReplaying = false;

function emit(next: OutboxState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

// Sauvegardes sérialisées, la plus récente gagne : jamais deux écritures concurrentes du fichier.
let saveChain: Promise<void> = Promise.resolve();

function persist(): Promise<void> {
  const bridge = window.pediatrixOutbox;
  if (!bridge) return Promise.resolve();
  saveChain = saveChain.then(async () => {
    try {
      const ok = await bridge.save(JSON.stringify({ items: state.items, failed: state.failed }));
      if (ok !== state.persistent) emit({ ...state, persistent: ok });
    } catch {
      emit({ ...state, persistent: false });
    }
  });
  return saveChain;
}

let loading: Promise<void> | null = null;

// Chargement unique et partagé ; ce qui a été saisi pendant le chargement est conservé (fusion).
export function loadOutbox(): Promise<void> {
  loading ??= (async () => {
    const bridge = window.pediatrixOutbox;
    if (!bridge) return;
    try {
      const raw = await bridge.load();
      if (!raw) {
        emit({ ...state, persistent: true });
        return;
      }
      const parsed = JSON.parse(raw) as { items?: OutboxItem[]; failed?: FailedItem[] };
      const known = new Set(state.items.map((item) => item.id));
      emit({
        items: [...(parsed.items ?? []).filter((item) => !known.has(item.id)), ...state.items],
        failed: [...(parsed.failed ?? []), ...state.failed],
        persistent: true,
      });
    } catch {
      // Contenu illisible (profil changé, clé perdue) : on garde la file en mémoire sans écraser le fichier.
      emit({ ...state, persistent: false });
      loadFailed = true;
    }
  })();
  return loading;
}

let loadFailed = false;

export function setOutboxUser(userId: string | null): void {
  currentUserId = userId;
  if (userId) void loadOutbox();
}

export async function enqueue(item: Omit<OutboxItem, "createdAt" | "userId" | "attempts">): Promise<void> {
  if (!currentUserId) throw new Error("Aucun utilisateur connecté.");
  await loadOutbox();
  emit({ ...state, items: [...state.items, { ...item, userId: currentUserId, createdAt: new Date().toISOString(), attempts: 0 }] });
  if (!loadFailed) await persist();
}

export function dismissFailed(id: string): void {
  emit({ ...state, failed: state.failed.filter((item) => item.id !== id) });
  if (!loadFailed) void persist();
}

export type ReplaySender = (item: OutboxItem) => Promise<void>;
export type ReplayClassifier = (error: unknown) => "network" | "unauthorized" | "duplicate" | "rejected" | "retry";

// Après ce nombre d'échecs serveur répétés, l'élément passe dans « à vérifier » au lieu de bloquer la file.
const MAX_ATTEMPTS = 5;

// Renvoie dans l'ordre les éléments de l'utilisateur connecté. Réseau coupé ou session expirée : on
// s'arrête (on réessaiera). Erreur serveur : l'élément est retenté, puis écarté vers « à vérifier »
// après MAX_ATTEMPTS, sans bloquer les suivants. Refus définitif (donnée invalide, patient disparu) :
// « à vérifier » avec le message du serveur, jamais perdu en silence.
export async function replayOutbox(send: ReplaySender, classify: ReplayClassifier): Promise<{ sent: number }> {
  if (isReplaying || !currentUserId) return { sent: 0 };
  isReplaying = true;
  const owner = currentUserId;
  let sent = 0;
  try {
    for (const item of state.items.filter((i) => i.userId === owner)) {
      // Un autre utilisateur s'est connecté pendant le renvoi : on s'arrête, rien ne part sous son nom.
      if (currentUserId !== owner) break;
      try {
        await send(item);
        sent += 1;
        emit({ ...state, items: state.items.filter((i) => i.id !== item.id) });
        if (!loadFailed) await persist();
      } catch (error) {
        const kind = classify(error);
        if (kind === "duplicate") {
          emit({ ...state, items: state.items.filter((i) => i.id !== item.id) });
          if (!loadFailed) await persist();
          continue;
        }
        const message = error instanceof Error ? error.message : "Refusé par le serveur.";
        const exhausted = kind === "retry" && item.attempts + 1 >= MAX_ATTEMPTS;
        if (kind === "rejected" || exhausted) {
          emit({ ...state, items: state.items.filter((i) => i.id !== item.id), failed: [...state.failed, { ...item, error: message }] });
          if (!loadFailed) await persist();
          continue;
        }
        if (kind === "retry") {
          emit({ ...state, items: state.items.map((i) => (i.id === item.id ? { ...i, attempts: i.attempts + 1 } : i)) });
          continue; // les autres saisies (autres patients) ne sont pas bloquées par celle-ci
        }
        break; // réseau coupé ou session expirée : on réessaiera plus tard
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
  // Un utilisateur ne voit que ses propres saisies en attente et ses propres refus.
  return {
    ...snapshot,
    failed: snapshot.failed.filter((item) => item.userId === currentUserId),
    mine: snapshot.items.filter((item) => item.userId === currentUserId),
  };
}

// Réservé aux tests.
export function __resetOutboxForTests(): void {
  state = { items: [], failed: [], persistent: false };
  currentUserId = null;
  loading = null;
  loadFailed = false;
  isReplaying = false;
}
