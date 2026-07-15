import { useCallback, useEffect, useState } from "react";
import "./App.css";

const BACKEND_URL = "http://localhost:3001";

type HealthStatus = "ok" | "degraded";
type ServiceStatus = "up" | "down";

interface HealthResponse {
  status: HealthStatus;
  backend: { status: "ok" };
  hapi: { status: ServiceStatus; fhirVersion: string | null };
}

type CheckState =
  | { phase: "loading" }
  | { phase: "success"; data: HealthResponse }
  | { phase: "error"; message: string };

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`flex items-center gap-2 text-sm ${ok ? "text-green-700" : "text-red-700"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
        {detail}
      </span>
    </div>
  );
}

function App() {
  const [check, setCheck] = useState<CheckState>({ phase: "loading" });

  const runCheck = useCallback(async () => {
    setCheck({ phase: "loading" });
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      const data: HealthResponse = await response.json();
      setCheck({ phase: "success", data });
    } catch (error) {
      setCheck({
        phase: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Pédiatrix — État du système</h1>
        <p className="mt-1 text-sm text-slate-500">
          Vérification de la chaîne backend → HAPI FHIR
        </p>

        <div className="mt-6 space-y-3">
          {check.phase === "loading" && (
            <p className="text-slate-500">Vérification en cours...</p>
          )}

          {check.phase === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800">Backend injoignable</p>
              <p className="mt-1 text-sm text-red-700">{check.message}</p>
            </div>
          )}

          {check.phase === "success" && (
            <>
              <StatusRow
                label="Backend"
                ok={check.data.backend.status === "ok"}
                detail={check.data.backend.status}
              />
              <StatusRow
                label="HAPI FHIR"
                ok={check.data.hapi.status === "up"}
                detail={
                  check.data.hapi.status === "up"
                    ? `connecté (FHIR ${check.data.hapi.fhirVersion ?? "?"})`
                    : "injoignable"
                }
              />
              <div
                className={`rounded-lg p-3 text-center text-sm font-medium ${
                  check.data.status === "ok"
                    ? "bg-green-50 text-green-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {check.data.status === "ok" ? "Système opérationnel" : "Mode dégradé"}
              </div>
            </>
          )}
        </div>

        <button
          onClick={runCheck}
          disabled={check.phase === "loading"}
          className="mt-6 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          Relancer la vérification
        </button>
      </div>
    </main>
  );
}

export default App;
