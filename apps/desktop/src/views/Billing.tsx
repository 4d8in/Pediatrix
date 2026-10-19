import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Banknote, CheckCircle2, Printer, Receipt, RefreshCw } from "lucide-react";
import { InvoiceSheet } from "../components/print/PrintSheets";
import {
  ApiError,
  addPayment,
  createInvoice,
  getBillingSummary,
  getTariffs,
  listBillableEncounters,
  listInvoices,
  saveTariffs,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { usePrint } from "../lib/print";
import type { BillableEncounter, BillingSummary, Invoice, PaymentMethod, TariffTable } from "../lib/types";
import { formatMoney } from "../lib/utils";
import { useI18n } from "../lib/i18n";

type Tab = "encounters" | "invoices" | "tariffs";

const METHOD_LABELS: Record<string, string> = { cash: "Espèces", mobile_money: "Mobile money", card: "Carte bancaire" };

const inputClass =
  "w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl";

function errorText(error: unknown, t: (fr: string) => string): string[] {
  if (error instanceof ApiError) return error.details ?? [error.message];
  return [t("Erreur inattendue.")];
}

function Errors({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-1 rounded-[18px] border border-red-200 bg-red-50 p-4">
      {messages.map((message) => (
        <p key={message} className="text-xs font-medium text-red-700">
          {message}
        </p>
      ))}
    </div>
  );
}

export default function Billing() {
  const { t, formatDateTime } = useI18n();
  const { user } = useAuth();
  const { printDocument } = usePrint();
  const isCashier = user?.role === "cashier";
  const canEditTariffs = user?.role === "director" || user?.role === "tech_admin";
  const tabs: { id: Tab; label: string }[] = [
    ...(isCashier ? [{ id: "encounters" as const, label: "À facturer" }] : []),
    { id: "invoices", label: "Factures" },
    { id: "tariffs", label: "Tarifs" },
  ];

  const [tab, setTab] = useState<Tab>(isCashier ? "encounters" : "invoices");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [encounters, setEncounters] = useState<BillableEncounter[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [insurer, setInsurer] = useState("");
  const [coverage, setCoverage] = useState("");
  const [billErrors, setBillErrors] = useState<string[]>([]);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [payErrors, setPayErrors] = useState<string[]>([]);

  const [tariffs, setTariffs] = useState<TariffTable | null>(null);
  const [drugItems, setDrugItems] = useState<{ code: string; name: string; unit: string }[]>([]);
  const [tariffMessage, setTariffMessage] = useState<string[]>([]);
  const [tariffSaved, setTariffSaved] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      getBillingSummary(),
      listInvoices(),
      getTariffs(),
      isCashier ? listBillableEncounters() : Promise.resolve({ encounters: [] as BillableEncounter[] }),
    ])
      .then(([summaryData, invoiceData, tariffData, encounterData]) => {
        setSummary(summaryData);
        setInvoices(invoiceData.invoices);
        setTariffs(tariffData.tariffs);
        setDrugItems(tariffData.items);
        setEncounters(encounterData.encounters);
      })
      .catch((error) => setLoadError(errorText(error, t).join(" ")))
      .finally(() => setIsLoading(false));
  }, [isCashier]);

  useEffect(load, [load]);

  async function handleBill(encounter: BillableEncounter) {
    setBillErrors([]);
    try {
      const { invoice } = await createInvoice(encounter.encounterId, {
        insurer: insurer || undefined,
        coveragePercent: coverage ? Number(coverage) : undefined,
      });
      setInsurer("");
      setCoverage("");
      setSelectedInvoice(invoice);
      setTab("invoices");
      load();
    } catch (error) {
      setBillErrors(errorText(error, t));
    }
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!selectedInvoice) return;
    setPayErrors([]);
    try {
      const { invoice } = await addPayment(selectedInvoice.id, { amount: Number(amount), method });
      setSelectedInvoice(invoice);
      setAmount("");
      load();
    } catch (error) {
      setPayErrors(errorText(error, t));
    }
  }

  async function handleSaveTariffs(event: FormEvent) {
    event.preventDefault();
    if (!tariffs) return;
    setTariffMessage([]);
    setTariffSaved(false);
    try {
      const { tariffs: saved } = await saveTariffs(tariffs);
      setTariffs(saved);
      setTariffSaved(true);
    } catch (error) {
      setTariffMessage(errorText(error, t));
    }
  }

  function setPrice(update: (table: TariffTable, value: number) => TariffTable, raw: string) {
    setTariffs((table) => (table ? update(table, Number(raw)) : table));
  }

  const tiles = summary
    ? [
        { label: "Encaissé aujourd'hui", value: formatMoney(summary.collectedToday, summary.currency) },
        { label: "Reste à encaisser", value: formatMoney(summary.outstanding, summary.currency) },
        { label: "À recevoir des assureurs", value: formatMoney(summary.insurerReceivable, summary.currency) },
      ]
    : [];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("Facturation")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("Factures, encaissements et tarifs de l'établissement")}</p>
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

      {tiles.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-[18px] border border-zinc-200/70 bg-white p-4">
              <p className="text-sm text-zinc-500">{t(tile.label)}</p>
              <p className="text-[22px] font-medium text-zinc-900">{tile.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            data-testid={`billing-tab-${item.id}`}
            className={`border-b-2 px-3 py-2 text-sm transition ${
              tab === item.id
                ? "border-[#1A6FD4] font-medium text-[#1A6FD4]"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t(item.label)}
            {item.id === "encounters" && ` (${encounters.length})`}
          </button>
        ))}
      </div>

      {tab === "encounters" && (
        <div className="space-y-4">
          <Errors messages={billErrors} />
          <div className="grid max-w-xl grid-cols-2 gap-4 rounded-[18px] border border-zinc-200/70 bg-white p-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Assureur / mutuelle (optionnel)")}</label>
              <input value={insurer} onChange={(event) => setInsurer(event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Prise en charge (%)")}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={coverage}
                onChange={(event) => setCoverage(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-[18px] border border-zinc-200/70 bg-white">
            {encounters.length === 0 && <p className="p-6 text-sm text-zinc-400">{t("Aucune consultation à facturer.")}</p>}
            {encounters.map((encounter) => (
              <div key={encounter.encounterId} className="flex items-center justify-between border-b border-zinc-50 p-5">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {encounter.patientName || t("Patient inconnu")}
                    {encounter.supplementary && (
                      <span data-testid="supplementary-badge" className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {t("Complément : {count} élément(s) non facturé(s)", { count: encounter.unbilledCount ?? 0 })}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {encounter.reason ?? t("Consultation")} ·{" "}
                    {encounter.date ? formatDateTime(encounter.date) : t("date inconnue")}
                  </p>
                </div>
                <button
                  onClick={() => handleBill(encounter)}
                  data-testid="bill-encounter"
                  className="flex items-center gap-2 rounded-full bg-[#1A6FD4] px-5 py-2 text-xs font-medium text-white hover:bg-[#155bb0]"
                >
                  <Receipt className="h-4 w-4" /> {encounter.supplementary ? t("Facturer le complément") : t("Facturer")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="flex min-h-[420px] flex-1 gap-4">
          <div className="w-[45%] overflow-y-auto rounded-[18px] border border-zinc-200/70 bg-white">
            {invoices.length === 0 && <p className="p-6 text-sm text-zinc-400">{t("Aucune facture.")}</p>}
            {invoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => {
                  setSelectedInvoice(invoice);
                  setPayErrors([]);
                }}
                className={`w-full border-b border-zinc-50 p-5 text-left ${
                  selectedInvoice?.id === invoice.id ? "bg-zinc-100/50" : "hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900">{invoice.patientName || t("Patient inconnu")}</h3>
                  <span
                    className={`rounded-xl border px-2 py-0.5 text-xs font-medium ${
                      invoice.status === "balanced"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {invoice.status === "balanced" ? t("Soldée") : t("À encaisser")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("Total {total} · reste {balance}", { total: formatMoney(invoice.total, invoice.currency), balance: formatMoney(invoice.balance, invoice.currency) })}
                </p>
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-[18px] border border-zinc-200/70 bg-white p-8">
            {!selectedInvoice ? (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-30">
                <Banknote className="mb-4 h-14 w-14" />
                <p className="text-sm font-medium">{t("Sélectionner une facture")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-zinc-900">{t("Facture de {name}", { name: selectedInvoice.patientName })}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(selectedInvoice.date)}
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-zinc-50">
                    {selectedInvoice.lines.map((line, index) => (
                      <tr key={index}>
                        <td className="py-2 text-zinc-700">{line.description}</td>
                        <td className="py-2 text-right text-zinc-900">{formatMoney(line.amount, selectedInvoice.currency)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 font-medium text-zinc-900">{t("Total")}</td>
                      <td className="py-2 text-right font-medium text-zinc-900">
                        {formatMoney(selectedInvoice.total, selectedInvoice.currency)}
                      </td>
                    </tr>
                    {selectedInvoice.coveragePercent > 0 && (
                      <tr>
                        <td className="py-2 text-zinc-500">
                          {t("Pris en charge par {insurer} ({percent} %)", { insurer: selectedInvoice.insurer ?? "", percent: selectedInvoice.coveragePercent })}
                        </td>
                        <td className="py-2 text-right text-zinc-500">
                          − {formatMoney(selectedInvoice.insurerShare, selectedInvoice.currency)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-zinc-500">{t("Déjà payé")}</td>
                      <td className="py-2 text-right text-zinc-500">{formatMoney(selectedInvoice.paid, selectedInvoice.currency)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium text-zinc-900">{t("Reste à payer")}</td>
                      <td className="py-2 text-right font-medium text-zinc-900" data-testid="invoice-balance">
                        {formatMoney(selectedInvoice.balance, selectedInvoice.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {selectedInvoice.payments.length > 0 && (
                  <ul className="space-y-1 text-xs text-zinc-500">
                    {selectedInvoice.payments.map((payment, index) => (
                      <li key={index}>
                        {formatMoney(payment.amount, selectedInvoice.currency)} · {METHOD_LABELS[payment.method] ? t(METHOD_LABELS[payment.method]) : payment.method}
                        {payment.date && ` · ${formatDateTime(payment.date)}`}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  data-testid="print-invoice"
                  onClick={() => printDocument((facility) => <InvoiceSheet facility={facility} invoice={selectedInvoice} />)}
                  className="flex items-center gap-2 text-xs font-medium text-[#1A6FD4] hover:underline"
                >
                  <Printer className="h-3.5 w-3.5" /> {selectedInvoice.status === "balanced" ? t("Imprimer le reçu") : t("Imprimer la facture")}
                </button>

                {selectedInvoice.status === "balanced" ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> {t("Facture soldée")}
                  </p>
                ) : (
                  isCashier && (
                    <form onSubmit={handlePay} className="space-y-3">
                      <Errors messages={payErrors} />
                      <div className="flex items-end gap-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-400">{t("Montant")}</label>
                          <input
                            type="number"
                            min={1}
                            required
                            data-testid="payment-amount"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className={`${inputClass} w-36`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-zinc-400">{t("Mode")}</label>
                          <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>
                            {Object.entries(METHOD_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {t(label)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          data-testid="payment-submit"
                          className="rounded-full bg-[#1A6FD4] px-6 py-2.5 text-xs font-medium text-white hover:bg-[#155bb0]"
                        >
                          {t("Encaisser")}
                        </button>
                      </div>
                    </form>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tariffs" && tariffs && (
        <form onSubmit={handleSaveTariffs} className="max-w-2xl space-y-5 rounded-[18px] border border-zinc-200/70 bg-white p-8">
          {!tariffs.customized && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {t("Tarifs d'exemple : la direction doit les adapter à l'établissement.")}
            </p>
          )}
          <Errors messages={tariffMessage} />
          {tariffSaved && <p className="text-xs font-medium text-green-700">{t("Grille enregistrée.")}</p>}
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["Consultation", "consultation"],
                ["Examen de labo (défaut)", "labDefault"],
                ["Imagerie (défaut)", "imagingDefault"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">
                  {t(label)} ({tariffs.currency})
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={!canEditTariffs}
                  data-testid={`tariff-${key}`}
                  value={tariffs[key]}
                  onChange={(event) => setPrice((table, value) => ({ ...table, [key]: value }), event.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
          <h3 className="pt-2 text-sm font-medium text-zinc-900">{t("Médicaments (prix unitaire)")}</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {drugItems.map((item) => (
              <div key={item.code} className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-700">{item.name}</span>
                <input
                  type="number"
                  min={0}
                  disabled={!canEditTariffs}
                  value={tariffs.drugs[item.code] ?? 0}
                  onChange={(event) =>
                    setPrice((table, value) => ({ ...table, drugs: { ...table.drugs, [item.code]: value } }), event.target.value)
                  }
                  className={`${inputClass} w-24`}
                />
              </div>
            ))}
          </div>
          {canEditTariffs && (
            <button
              type="submit"
              data-testid="tariff-save"
              className="rounded-full bg-[#1A6FD4] px-8 py-3 text-xs font-medium text-white hover:bg-[#155bb0]"
            >
              {t("Enregistrer la grille")}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
