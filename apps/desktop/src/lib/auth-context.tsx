import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as apiLogin, setAuthToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Le token n'est jamais persisté (pas de localStorage) : il vit uniquement en
// mémoire, via l'état React ci-dessous et le module api.ts. Fermer l'app = perdre
// la session, ce qui est voulu sur un poste partagé à l'hôpital.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider.");
  }
  return context;
}
