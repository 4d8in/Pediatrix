import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Pill, RefreshCw, User } from "lucide-react";
import {
  ApiError,
  dispensePrescription,
  getFormulary,
  getStock,
  listPendingPrescriptions,
  receiveStock,
} from "../lib/api";
import type { FormularyItem, PendingPrescription, StockLevel } from "../lib/types";
import { useI18n } from "../lib/i18n";

type Tab = "prescriptions" | "stock" | "reception";

const TABS: { id: Tab; label: string }[] = [
  { id: "prescriptions", label: "Ordonnances à délivrer" },
  { id: "stock", label: "Stock" },
  { id: "reception", label: "Réception" },
];

const inputClass =
  "w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl";

function errorText(error: unknown, t: (fr: string) => string): string[] {
  if (error instanceof ApiError) return error.details ?? [error.message];
  return [t("Erreur inattendue.")];
}

// Propose l'article du formulaire dont le nom ressemble le plus au médicament prescrit.
function suggestItem(medication: string | null, formulary: FormularyItem[]): string {
  const text = (medication ?? "").toLowerCase();
  if (!text) return "";
  const first = text.split(/[\s,]+/)[0];
  return formulary.find((item) => item.name.toLowerCase().includes(first))?.code ?? "";
}

export default function Pharmacy() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("prescriptions");
  const [formulary, setFormulary] = useState<FormularyItem[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [prescriptions, setPrescriptions] = useState<PendingPrescription[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selected, setSelected] = useState<PendingPrescription | null>(null);
  const [itemCode, setItemCode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dispenseErrors, setDispenseErrors] = useState<string[]>([]);
  const [dispensed, setDispensed] = useState<string | null>(null);

  const [receiptItem, setReceiptItem] = useState("");
  const [receiptQuantity, setReceiptQuantity] = useState("");
  const [receiptLot, setReceiptLot] = useState("");
  const [receiptExpiry, setReceiptExpiry] = useState("");
  const [receiptErrors, setReceiptErrors] = useState<string[]>([]);
  const [receiptDone, setReceiptDone] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getFormulary(), getStock(), listPendingPrescriptions()])
      .then(([formularyData, stockData, prescriptionData]) => {
        setFormulary(formularyData.items);
        setStock(stockData.items);
        setPrescriptions(prescriptionData.prescriptions);
      })
      .catch((error) => setLoadError(errorText(error, t).join(" ")))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  function selectPrescription(prescription: PendingPrescription) {
    setSelected(prescription);
    setItemCode(suggestItem(prescription.medication, formulary));
    setQuantity("1");
    setDispenseErrors([]);
    setDispensed(null);
  }

  async function handleDispense(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setDispenseErrors([]);
    try {
      try {
        await dispensePrescription(selected.id, { itemCode, quantity: Number(quantity) });
      } catch (error) {
        // Article différent du médicament prescrit : le pharmacien doit confirmer explicitement.
        if (error instanceof ApiError && (error.body as { kind?: string } | undefined)?.kind === "mismatch" && window.confirm(error.message)) {
          await dispensePrescription(selected.id, { itemCode, quantity: Number(quantity), confirmMismatch: true });
        } else {
          throw error;
        }
      }
      setDispensed(selected.id);
      setPrescriptions((rows) => rows.filter((row) => row.id !== selected.id));
      getStock().then((data) => setStock(data.items)).catch(() => undefined);
    } catch (error) {
      setDispenseErrors(errorText(error, t));
    }
  }

  async function handleReceive(event: FormEvent) {
    event.preventDefault();
    setReceiptErrors([]);
    setReceiptDone(null);
    try {
      await receiveStock({
        itemCode: receiptItem,
        quantity: Number(receiptQuantity),
        lot: receiptLot || undefined,
        expiry: receiptExpiry || undefined,
      });
      const name = formulary.find((item) => item.code === receiptItem)?.name ?? receiptItem;
      setReceiptDone(t("{quantity} × {name} reçus en stock.", { quantity: receiptQuantity, name }));
      setReceiptQuantity("");
      setReceiptLot("");
      setReceiptExpiry("");
      getStock().then((data) => setStock(data.items)).catch(() => undefined);
    } catch (error) {
      setReceiptErrors(errorText(error, t));
    }
  }

  const lowCount = stock.filter((item) => item.low).length;
  const selectedItem = formulary.find((item) => item.code === itemCode);
  const available = stock.find((item) => item.code === itemCode)?.quantity;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("Pharmacie")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("Délivrance des ordonnances, stock et réceptions")}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> {t("Actualiser")}
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      <div className="flex gap-1 border-b border-zinc-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            data-testid={`pharmacy-tab-${item.id}`}
            className={`border-b-2 px-3 py-2 text-sm transition ${
              tab === item.id
                ? "border-[#1A6FD4] font-medium text-[#1A6FD4]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t(item.label)}
            {item.id === "prescriptions" && ` (${prescriptions.length})`}
            {item.id === "stock" && lowCount > 0 && ` · ${t("{count} à réapprovisionner", { count: lowCount })}`}
          </button>
        ))}
      </div>

      {tab === "prescriptions" && (
        <div className="flex min-h-[480px] flex-1 gap-4">
          <div className="w-[40%] overflow-y-auto rounded-[18px] border border-zinc-200/70 bg-white">
            {prescriptions.length === 0 && <p className="p-6 text-sm text-zinc-400">{t("Aucune ordonnance en attente.")}</p>}
            {prescriptions.map((prescription) => (
              <button
                key={prescription.id}
                onClick={() => selectPrescription(prescription)}
                className={`w-full border-b border-zinc-50 p-5 text-left transition-all ${
                  selected?.id === prescription.id ? "bg-zinc-100/50" : "hover:bg-zinc-50"
                }`}
              >
                <h3 className="text-sm font-medium text-zinc-900">{prescription.medication ?? t("Médicament non précisé")}</h3>
                <p className="mt-1 text-xs text-zinc-500">{prescription.dosage ?? t("Posologie non précisée")}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                  <User className="h-3 w-3" /> {prescription.patientName || t("Patient inconnu")}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-[18px] border border-zinc-200/70 bg-white p-8">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-30">
                <Pill className="mb-4 h-14 w-14" />
                <p className="text-sm font-medium">{t("Sélectionner une ordonnance")}</p>
              </div>
            ) : dispensed === selected.id ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-green-600" />
                <h3 className="text-lg font-medium text-zinc-900">{t("Médicament délivré")}</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="mt-8 rounded-full bg-[#1A6FD4] px-8 py-3 text-sm font-medium text-white hover:bg-[#155bb0]"
                >
                  {t("Ordonnance suivante")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleDispense} className="space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-zinc-900">
                    {selected.patientName} — {selected.medication}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{t("Posologie : {dosage}", { dosage: selected.dosage ?? t("non précisée") })}</p>
                </div>
                {dispenseErrors.length > 0 && (
                  <div className="space-y-1 rounded-[18px] border border-red-200 bg-red-50 p-4">
                    {dispenseErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">{t("Article délivré")}</label>
                  <select
                    required
                    data-testid="dispense-item"
                    value={itemCode}
                    onChange={(event) => setItemCode(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("Choisir dans le formulaire…")}</option>
                    {formulary.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {selectedItem && (
                    <p className="text-xs text-zinc-400">
                      {t("En stock : {quantity} {unit}(s)", { quantity: available ?? 0, unit: selectedItem.unit })}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">{t("Quantité")}{selectedItem ? ` (${selectedItem.unit}s)` : ""}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    data-testid="dispense-quantity"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    className={`${inputClass} w-32`}
                  />
                </div>
                <button
                  type="submit"
                  data-testid="dispense-submit"
                  className="rounded-full bg-[#1A6FD4] px-8 py-3 text-xs font-medium text-white hover:bg-[#155bb0]"
                >
                  {t("Délivrer")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === "stock" && (
        <div className="overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs text-zinc-400">
              <tr>
                <th className="px-6 py-3 font-medium">{t("Article")}</th>
                <th className="px-3 py-3 font-medium">{t("Forme")}</th>
                <th className="px-3 py-3 font-medium">{t("En stock")}</th>
                <th className="px-3 py-3 font-medium">{t("Seuil")}</th>
                <th className="px-3 py-3 font-medium">{t("État")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {stock.map((item) => (
                <tr key={item.code}>
                  <td className="px-6 py-3 text-zinc-900">{item.name}</td>
                  <td className="px-3 py-3 text-zinc-500">{item.form}</td>
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-3 text-zinc-500">{item.reorderLevel}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.expiredQuantity > 0 && (
                        <span
                          data-testid={`expired-${item.code}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                        >
                          <AlertTriangle className="h-3 w-3" /> {t("{count} périmé(s), à retirer", { count: item.expiredQuantity })}
                        </span>
                      )}
                      {item.expiringSoonQuantity > 0 && (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          {t("{count} périment sous 90 j", { count: item.expiringSoonQuantity })}
                        </span>
                      )}
                      {item.low ? (
                        <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> {t("À réapprovisionner")}
                        </span>
                      ) : (
                        item.expiredQuantity === 0 && <span className="text-xs text-green-700">{t("Suffisant")}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "reception" && (
        <form onSubmit={handleReceive} className="max-w-xl space-y-5 rounded-[18px] border border-zinc-200/70 bg-white p-8">
          <h2 className="text-sm font-medium text-zinc-900">{t("Réception d'une livraison")}</h2>
          {receiptDone && <p className="text-xs font-medium text-green-700">{receiptDone}</p>}
          {receiptErrors.length > 0 && (
            <div className="space-y-1 rounded-[18px] border border-red-200 bg-red-50 p-4">
              {receiptErrors.map((message) => (
                <p key={message} className="text-xs font-medium text-red-700">
                  {message}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">{t("Article")}</label>
            <select
              required
              data-testid="receipt-item"
              value={receiptItem}
              onChange={(event) => setReceiptItem(event.target.value)}
              className={inputClass}
            >
              <option value="">{t("Choisir dans le formulaire…")}</option>
              {formulary.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Quantité")}</label>
              <input
                type="number"
                min={1}
                required
                data-testid="receipt-quantity"
                value={receiptQuantity}
                onChange={(event) => setReceiptQuantity(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("N° de lot")}</label>
              <input value={receiptLot} onChange={(event) => setReceiptLot(event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Péremption")}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4}-\d{2}-\d{2}"
                placeholder={t("AAAA-MM-JJ")}
                value={receiptExpiry}
                onChange={(event) => setReceiptExpiry(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="submit"
            data-testid="receipt-submit"
            className="rounded-full bg-[#1A6FD4] px-8 py-3 text-xs font-medium text-white hover:bg-[#155bb0]"
          >
            {t("Enregistrer la réception")}
          </button>
        </form>
      )}
    </div>
  );
}
