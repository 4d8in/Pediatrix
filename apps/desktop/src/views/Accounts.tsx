import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { ApiError, createUserAccount, listUserAccounts, resetUserPassword, setUserActive } from "../lib/api";
import type { Role, UserAccount } from "../lib/types";
import { cn } from "../lib/utils";

const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};

const inputClass = "w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#1A6FD4]";

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable.";
}

// Gestion des comptes (administrateur technique) : création, réinitialisation du
// mot de passe, activation / désactivation.
export default function Accounts() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ username: "", displayName: "", role: "nurse" as Role, password: "" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(() => {
    listUserAccounts()
      .then((data) => setUsers(data.users))
      .catch((err) => setMessage({ ok: false, text: errorText(err) }));
  }, []);

  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setIsBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      load();
      return true;
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) });
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const ok = await run(() => createUserAccount(form), `Compte « ${form.username} » créé.`);
    if (ok) setForm({ username: "", displayName: "", role: "nurse", password: "" });
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    if (!resetFor) return;
    const ok = await run(() => resetUserPassword(resetFor, newPassword), `Mot de passe de « ${resetFor} » réinitialisé.`);
    if (ok) {
      setResetFor(null);
      setNewPassword("");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Comptes utilisateurs</h1>
        <p className="mt-1 text-sm text-zinc-500">Créer, désactiver un compte ou réinitialiser un mot de passe</p>
      </div>

      {message && (
        <p
          className={cn(
            "rounded-xl border p-3 text-sm",
            message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500">
                <th className="py-3 font-normal">Identifiant</th>
                <th className="py-3 font-normal">Nom</th>
                <th className="py-3 font-normal">Rôle</th>
                <th className="py-3 font-normal">Statut</th>
                <th className="py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((account) => (
                <tr key={account.username}>
                  <td className="py-3 text-zinc-900">{account.username}</td>
                  <td className="py-3 text-zinc-700">{account.displayName}</td>
                  <td className="py-3 text-zinc-700">{ROLE_LABELS[account.role]}</td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs",
                        account.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500",
                      )}
                    >
                      {account.active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setResetFor(account.username);
                          setNewPassword("");
                        }}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 transition hover:border-[#1A6FD4] hover:text-[#1A6FD4]"
                      >
                        Mot de passe
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() =>
                          run(
                            () => setUserActive(account.username, !account.active),
                            `Compte « ${account.username} » ${account.active ? "désactivé" : "réactivé"}.`,
                          )
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-40",
                          account.active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                        )}
                      >
                        {account.active ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
              <UserPlus className="h-5 w-5 text-[#1A6FD4]" /> Nouveau compte
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                placeholder="Identifiant (ex. infirmiere2)"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                className={inputClass}
              />
              <input
                required
                placeholder="Nom affiché (ex. Fatou Ndiaye)"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                className={inputClass}
              />
              <select
                aria-label="Rôle"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
                className={inputClass}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="Mot de passe initial (8 caractères minimum)"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={isBusy}
                className="w-full rounded-lg bg-[#1A6FD4] py-2.5 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-40"
              >
                Créer le compte
              </button>
            </form>
          </section>

          {resetFor && (
            <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
                <KeyRound className="h-5 w-5 text-[#1A6FD4]" /> Mot de passe de « {resetFor} »
              </h2>
              <form onSubmit={handleReset} className="space-y-3">
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Nouveau mot de passe"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="flex-1 rounded-lg bg-[#1A6FD4] py-2.5 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-40"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetFor(null)}
                    className="rounded-lg border border-zinc-200 px-4 text-sm text-zinc-700"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
