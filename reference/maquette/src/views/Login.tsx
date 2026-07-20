import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login({ onLogin }: { onLogin: (role?: string) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [credentials, setCredentials] = useState({
    identifier: '',
    password: '',
    role: 'infirmier'
  });

  const isOnline = navigator.onLine;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate error for demonstration if identifier is "error"
    if (credentials.identifier === 'error') {
      setError(true);
      return;
    }
    setError(false);
    onLogin(credentials.role);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setCredentials(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F3F4F6] relative overflow-hidden font-sans">
      {/* Top-right Sync Status Indicator */}
      <div className="absolute top-8 right-8 flex items-center gap-2 bg-white px-4 py-2 shadow-sm border border-zinc-200">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          isOnline ? "bg-green-500" : "bg-orange-500"
        )}></div>
        <span className="text-[12px] font-medium text-zinc-600">
          {isOnline ? "Connecté" : "Mode hors-ligne"}
        </span>
      </div>

      <main className="w-full max-w-[400px] relative z-10">
        <div className="bg-white shadow-xl overflow-hidden rounded-lg">
          {/* Brand Header */}
          <div className="pt-12 pb-8 px-10 text-center">
            <h1 className="text-4xl font-extrabold text-[#1A6FD4] mb-2 tracking-tight">Pédiatrix</h1>
            <p className="text-sm font-medium text-zinc-500">Service Pédiatrie — Hôpital de District</p>
          </div>

          <form onSubmit={handleSubmit} className="px-10 pb-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 p-4 flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-[13px] leading-tight text-red-700 font-medium">
                  Identifiant ou mot de passe incorrect. Contactez l'administrateur.
                </p>
              </div>
            )}

            {/* Identifiant */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-zinc-700 ml-1" htmlFor="identifier">Identifiant</label>
              <input 
                type="text" 
                id="identifier" 
                value={credentials.identifier}
                onChange={handleInputChange}
                className="w-full bg-white border border-zinc-300 px-4 py-3.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#1A6FD4] focus:border-transparent transition-all min-h-[44px]" 
                placeholder="Votre identifiant"
                required
              />
            </div>

            {/* Mot de passe */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-zinc-700 ml-1" htmlFor="password">Mot de passe</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  value={credentials.password}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-zinc-300 px-4 py-3.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#1A6FD4] focus:border-transparent transition-all min-h-[44px]" 
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-[#1A6FD4] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Role Manager */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-zinc-700 ml-1" htmlFor="role">Rôle</label>
              <select 
                id="role" 
                value={credentials.role}
                onChange={handleInputChange}
                className="w-full bg-white border border-zinc-300 px-4 py-3.5 text-[15px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#1A6FD4] focus:border-transparent transition-all min-h-[44px] appearance-none"
                required
              >
                <option value="" disabled>Choisir un rôle</option>
                <option value="accueil">Accueil</option>
                <option value="infirmier">Infirmier</option>
                <option value="medecin">Médecin</option>
                <option value="technicien_labo">Technicien Labo</option>
                <option value="chef_de_service">Chef de service</option>
                <option value="directeur">Directeur</option>
                <option value="admin_tech">Administrateur technique</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#1A6FD4] text-white font-bold text-base py-4 px-8 shadow-lg hover:shadow-[#1A6FD4]/20 hover:bg-[#1559ab] active:scale-[0.98] transition-all flex items-center justify-center gap-3 min-h-[48px]"
            >
              Se connecter
            </button>

            <div className="text-center pt-2">
              <a 
                href="#" 
                onClick={(e) => e.preventDefault()}
                className="text-xs font-medium text-zinc-500 hover:text-[#1A6FD4] transition-colors"
              >
                Mot de passe oublié ? → <span className="underline">Contacter l'administrateur</span>
              </a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
