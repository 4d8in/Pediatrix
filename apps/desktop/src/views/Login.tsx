import { useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth-context";

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
    } catch {
      setError("Identifiant ou mot de passe incorrect.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <main className="w-full max-w-[400px]">
        <div className="bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="pt-12 pb-8 px-10 text-center border-b border-zinc-100">
            <h1 className="text-3xl font-black text-[#1A6FD4] tracking-tight mb-2">Pédiatrix</h1>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
              Service Pédiatrie — Hôpital de District
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-10 space-y-8">
            {notice && (
              <div className="bg-amber-50 border border-amber-200 p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-xs font-bold text-amber-700">{notice}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400" htmlFor="username">
                Identifiant
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs"
                placeholder="votre identifiant"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-zinc-900 outline-none transition-all font-bold text-xs"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest py-4 hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
