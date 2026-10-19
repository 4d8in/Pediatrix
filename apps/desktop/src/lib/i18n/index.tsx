import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { EN } from "./en";

// Internationalisation sans dépendance (fonctionne hors ligne). Le TEXTE FRANÇAIS sert de clé :
// t("Enregistrer") renvoie « Save » en anglais, et le français tel quel sinon (ou si la
// traduction manque). Les variables s'écrivent {nom} : t("Bonjour {nom}", { nom }).
// Règle : ne jamais traduire au niveau du module (les libellés ne suivraient pas le changement
// de langue) ; garder le français dans les constantes et appeler t() au rendu.

export type Lang = "fr" | "en";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

const STORAGE_KEY = "pediatrix.lang";

function readStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "fr" ? stored : "fr";
  } catch {
    return "fr";
  }
}

export function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function translateTo(lang: Lang, fr: string, vars?: Record<string, string | number>): string {
  const text = lang === "en" ? (EN[fr] ?? fr) : fr;
  return interpolate(text, vars);
}

export const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (fr: string, vars?: Record<string, string | number>) => string;
  // Dates et nombres dans la langue choisie.
  formatDateTime: (iso: string | null | undefined) => string;
  formatDate: (iso: string | null | undefined) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // stockage indisponible : la langue reste valable pour la session
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (fr, vars) => translateTo(lang, fr, vars),
      formatDateTime: (iso) => (iso ? new Date(iso).toLocaleString(LOCALES[lang]) : ""),
      formatDate: (iso) => (iso ? new Date(iso).toLocaleDateString(LOCALES[lang]) : ""),
    }),
    [lang, setLang],
  );

  // key={lang} : tout l'arbre est remonté au changement de langue, pour que chaque libellé suive.
  return (
    <I18nContext.Provider value={value}>
      <div key={lang} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n doit être utilisé dans <I18nProvider>.");
  return value;
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <select
      aria-label="Language / Langue"
      data-testid="language-switch"
      value={lang}
      onChange={(event) => setLang(event.target.value as Lang)}
      className={className ?? "rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"}
    >
      {LANGS.map((item) => (
        <option key={item.code} value={item.code}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
