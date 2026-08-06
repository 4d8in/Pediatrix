import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as apiLogin, getMe, hasAuthToken, setAuthToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Le token n'est jamais persisté (pas de localStorage) : il vit uniquement en
// mémoire, via l'état React ci-dessous et le module api.ts. Fermer l'app —ou
// recharger complètement la page— fait perdre le token, donc la session :
// c'est voulu sur un poste partagé à l'hôpital. isRestoring/GET /api/auth/me
// ne couvrent que le cas où le token est encore là mais `user` a été perdu
// (ex. AuthProvider remonté sans rechargement complet), pas un vrai "rester
// connecté" entre deux lancements de l'app.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isRestoring, setIsRestoring] = useState(() => hasAuthToken());

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionExpired(true);
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restaure l'utilisateur courant si un token est déjà en mémoire au montage
  // (voir commentaire ci-dessus). Si le token est absent, on ne fait aucun
  // appel : GET /api/auth/me répondrait 401 même sans session expirée, ce qui
  // afficherait à tort "Session expirée" dès le tout premier lancement.
  useEffect(() => {
    if (!hasAuthToken()) return;
    getMe()
      .then((restoredUser) => setUser(restoredUser))
      .catch(() => {
        // Token présent mais invalide/expiré : le 401 déclenche déjà
        // onUnauthorized (sessionExpired + logout) via request(), rien à faire ici.
      })
      .finally(() => setIsRestoring(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setAuthToken(result.token);
    setUser(result.user);
    setSessionExpired(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, sessionExpired, login, logout }),
    [user, sessionExpired, login, logout],
  );

  if (isRestoring) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider.");
  }
  return context;
}
