// Statut de mise à jour partagé entre le processus principal, le preload
// et l'interface React (src/components/UpdateBanner.tsx). Types seuls.
export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "downloading"; version: string; percent: number }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };
