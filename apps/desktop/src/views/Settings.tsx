import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, KeyRound, LifeBuoy, Server, UserRound } from "lucide-react";
import { ApiError, BACKEND_BASE_URL, changePassword } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { Role } from "../lib/types";

const ROLE_LABELS: Record<Role, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  director: "Directeur",
  tech_admin: "Administrateur technique",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-zinc-100 py-2.5 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-900">{value}</span>
    </div>
  );
}

// Paramètres du poste : compte connecté, changement de mot de passe, informations
// de connexion au serveur et aide. Aucune donnée n'est envoyée hors du LAN.
export default function Settings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setMessage({ ok: false, text: "La confirmation ne correspond pas au nouveau mot de passe." });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setMessage({ ok: true, text: "Mot de passe modifié." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "Le serveur Pédiatrix est injoignable." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) return null;

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1A6FD4]";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">Paramètres</h1>
        <p className="mt-1 text-sm text-zinc-500">Votre compte, votre mot de passe et l'aide</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
            <UserRound className="h-5 w-5 text-[#1A6FD4]" /> Mon compte
          </h2>
          <Field label="Nom" value={user.name} />
          <Field label="Rôle" value={ROLE_LABELS[user.role]} />
          <Field label="Référence praticien" value={user.id} />
        </section>

        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
            <KeyRound className="h-5 w-5 text-[#1A6FD4]" /> Changer mon mot de passe
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Mot de passe actuel"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Nouveau mot de passe (8 caractères minimum)"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={inputClass}
            />
            {message && (
              <p className={`flex items-center gap-2 text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
                {message.ok && <CheckCircle2 className="h-4 w-4" />} {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#1A6FD4] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-50"
            >
              {isSubmitting ? "Enregistrement…" : "Modifier le mot de passe"}
            </button>
          </form>
        </section>

        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
            <Server className="h-5 w-5 text-[#1A6FD4]" /> Poste
          </h2>
          <Field label="Serveur Pédiatrix (LAN)" value={BACKEND_BASE_URL} />
          <Field label="Mises à jour" value="Automatiques, depuis le serveur du LAN" />
        </section>

        <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg text-zinc-700">
            <LifeBuoy className="h-5 w-5 text-[#1A6FD4]" /> Aide
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>Mot de passe oublié ou compte bloqué : contactez l'administrateur technique.</li>
            <li>Serveur injoignable : vérifiez que le poste est bien branché au réseau de l'hôpital.</li>
            <li>La session se ferme à la fermeture de l'application (poste partagé).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
