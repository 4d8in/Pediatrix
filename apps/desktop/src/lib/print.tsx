import { useI18n } from "./i18n";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { getFacility } from "./api";
import type { Facility } from "./types";

// Impression de documents (facture, ordonnance, compte rendu, carnet) :
// le document est rendu dans une zone dédiée, visible seulement à l'impression
// (voir App.css) ; le dialogue d'impression du système permet aussi d'enregistrer en PDF.
interface PrintContextValue {
  // Charge l'identité de l'établissement (une fois), puis imprime le document rendu avec elle.
  printDocument: (render: (facility: Facility) => ReactNode) => Promise<void>;
}

const FALLBACK_FACILITY: Facility = { name: "Établissement de santé", address: "", phone: "" };

const PrintContext = createContext<PrintContextValue>({ printDocument: async () => undefined });

export function PrintProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<ReactNode>(null);
  const facilityRef = useRef<Facility | null>(null);
  const { t } = useI18n();

  const printDocument = useCallback(async (render: (facility: Facility) => ReactNode) => {
    if (!facilityRef.current) {
      facilityRef.current = await getFacility().catch(() => ({ ...FALLBACK_FACILITY, name: t(FALLBACK_FACILITY.name) }));
    }
    setSheet(render(facilityRef.current));
  }, [t]);

  // Une fois le document monté, on lance l'impression puis on le retire.
  useEffect(() => {
    if (!sheet) return;
    const frame = requestAnimationFrame(() => {
      window.print();
      setSheet(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [sheet]);

  return (
    <PrintContext.Provider value={{ printDocument }}>
      <div className="app-shell">{children}</div>
      {createPortal(<div id="print-root">{sheet}</div>, document.body)}
    </PrintContext.Provider>
  );
}

export function usePrint(): PrintContextValue {
  return useContext(PrintContext);
}
