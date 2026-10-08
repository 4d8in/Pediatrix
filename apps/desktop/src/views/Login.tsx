import { useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, HeartPulse, Lock, Stethoscope, User } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { LogoBadge } from "../components/Logo";

interface LoginProps {
  notice?: string;
}

export default function Login({ notice }: LoginProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      // 403 = compte désactivé par l'administrateur technique (message du backend).
      setError(
        err instanceof ApiError && err.status === 403 ? err.message : "Identifiant ou mot de passe incorrect.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white font-sans">
      {/* Panneau d'accueil (maquette de référence) : logo, devise, illustration locale en SVG. */}
      <aside className="relative hidden w-[46%] flex-col items-center justify-center overflow-hidden bg-[#EAF2FC] md:flex">
        <div className="relative z-10 flex flex-col items-center text-center">
          <LogoBadge className="h-28 w-28 drop-shadow-sm" />
          <p className="mt-4 text-5xl font-semibold text-[#0B2A4F]">Pédiatrix</p>
          <p className="mt-4 max-w-xs text-lg leading-relaxed text-[#0B2A4F]/70">
            Des enfants en bonne santé, un avenir meilleur.
          </p>
        </div>
        <Stethoscope aria-hidden className="absolute -bottom-6 -left-6 h-72 w-72 text-[#1A6FD4]/10" strokeWidth={1} />
        <HeartPulse aria-hidden className="absolute -right-10 top-10 h-56 w-56 text-[#1A6FD4]/10" strokeWidth={1} />
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-[28px] font-medium text-zinc-900">Connexion</h1>
            <p className="mt-1 text-sm text-zinc-500">Accédez à votre espace sécurisé</p>
          </div>

          {notice && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-800">{notice}</p>
            </div>
          )}

          {error && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-zinc-700" htmlFor="username">
              Identifiant
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="username"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm text-zinc-900 outline-none transition focus:border-[#1A6FD4]"
                placeholder="ex. medecin1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-700" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-10 pr-11 text-sm text-zinc-900 outline-none transition focus:border-[#1A6FD4]"
                placeholder="Votre mot de passe"
              />
              <button
                type="button"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A6FD4] py-3 text-sm font-medium text-white transition hover:bg-[#155bb0] disabled:opacity-50"
          >
            {isSubmitting ? "Connexion..." : "Se connecter"}
            {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>

          <p className="pt-4 text-center text-xs text-zinc-500">
            Vous n'avez pas de compte ? <span className="font-medium text-[#1A6FD4]">Contactez l'administrateur</span>
          </p>
        </form>
      </main>
    </div>
  );
}
