import { randomUUID } from "node:crypto";
import type { TariffTable } from "../../lib/tariffs.js";

// Facturation = ressources FHIR Invoice (une par consultation) + PaymentNotice
// (un par encaissement). Le solde se déduit des encaissements, comme le stock.
export const INVOICE_ENCOUNTER_SYSTEM = "http://pediatrix.local/fhir/invoice-encounter";
export const INSURER_EXTENSION_URL = "http://pediatrix.local/fhir/invoice-insurer";
export const COVERAGE_EXTENSION_URL = "http://pediatrix.local/fhir/invoice-coverage-percent";
// Éléments déjà facturés (« ServiceRequest/12 », « MedicationDispense/7 », « Encounter/3 » pour la
// consultation) : permet une facture complémentaire pour ce qui est demandé ou délivré après coup.
export const INVOICE_SOURCE_SYSTEM = "http://pediatrix.local/fhir/invoice-source";
export const PATIENT_SHARE_EXTENSION_URL = "http://pediatrix.local/fhir/invoice-patient-share";

export const PAYMENT_METHODS = ["cash", "mobile_money", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile money",
  card: "Carte bancaire",
};

export interface InvoiceLine {
  // Ressource facturée par cette ligne (voir INVOICE_SOURCE_SYSTEM).
  source?: string;
  kind: "consultation" | "lab" | "imaging" | "drug";
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ServiceRequestLike {
  id?: string;
  authoredOn?: string;
  code?: { text?: string; coding?: { code?: string }[] };
  category?: { coding?: { code?: string }[] }[];
}

interface DispenseLike {
  id?: string;
  whenHandedOver?: string;
  medicationCodeableConcept?: { text?: string; coding?: { code?: string }[] };
  quantity?: { value?: number };
}

export function buildInvoiceLines(
  serviceRequests: ServiceRequestLike[],
  dispenses: DispenseLike[],
  tariffs: TariffTable,
  options: { encounterId?: string; includeConsultation?: boolean } = {},
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  if (options.includeConsultation ?? true) {
    lines.push({
      source: options.encounterId ? `Encounter/${options.encounterId}` : undefined,
      kind: "consultation",
      description: "Consultation pédiatrique",
      quantity: 1,
      unitPrice: tariffs.consultation,
      amount: tariffs.consultation,
    });
  }

  for (const sr of serviceRequests) {
    const isImaging = sr.category?.some((c) => c.coding?.some((coding) => coding.code === "imaging"));
    const code = sr.code?.coding?.[0]?.code;
    const unitPrice = isImaging ? tariffs.imagingDefault : (code && tariffs.labByCode[code]) || tariffs.labDefault;
    lines.push({
      source: sr.id ? `ServiceRequest/${sr.id}` : undefined,
      kind: isImaging ? "imaging" : "lab",
      description: sr.code?.text ?? (isImaging ? "Examen d'imagerie" : "Examen de laboratoire"),
      quantity: 1,
      unitPrice,
      amount: unitPrice,
    });
  }

  for (const dispense of dispenses) {
    const code = dispense.medicationCodeableConcept?.coding?.[0]?.code;
    const quantity = dispense.quantity?.value ?? 1;
    const unitPrice = (code && tariffs.drugs[code]) || 0;
    lines.push({
      source: dispense.id ? `MedicationDispense/${dispense.id}` : undefined,
      kind: "drug",
      description: dispense.medicationCodeableConcept?.text ?? "Médicament",
      quantity,
      unitPrice,
      amount: Math.round(unitPrice * quantity),
    });
  }

  return lines;
}

export interface InvoiceTotals {
  total: number;
  insurerShare: number;
  patientShare: number;
}

// Part prise en charge par l'assureur = pourcentage du total, arrondie ; le patient paie le reste.
export function computeTotals(lines: InvoiceLine[], coveragePercent: number): InvoiceTotals {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const insurerShare = Math.round((total * coveragePercent) / 100);
  return { total, insurerShare, patientShare: total - insurerShare };
}

export function toFhirInvoice(
  patientId: string,
  patientName: string,
  encounterId: string,
  lines: InvoiceLine[],
  totals: InvoiceTotals,
  currency: string,
  insurance: { insurer?: string; coveragePercent: number },
  issuedBy: string,
) {
  const money = (value: number) => ({ value, currency });
  return {
    resourceType: "Invoice",
    // Part patient nulle (prise en charge à 100 %) : rien à encaisser, la facture est soldée d'emblée.
    status: totals.patientShare === 0 ? "balanced" : "issued",
    identifier: [
      { system: INVOICE_ENCOUNTER_SYSTEM, value: encounterId },
      ...lines.filter((line) => line.source).map((line) => ({ system: INVOICE_SOURCE_SYSTEM, value: line.source })),
    ],
    subject: { reference: `Patient/${patientId}`, display: patientName },
    date: new Date().toISOString(),
    participant: [{ actor: { display: issuedBy } }],
    lineItem: lines.map((line, index) => ({
      sequence: index + 1,
      chargeItemCodeableConcept: { text: line.quantity > 1 ? `${line.description} × ${line.quantity}` : line.description },
      priceComponent: [{ type: "base", code: { text: line.kind }, amount: money(line.amount) }],
    })),
    totalNet: money(totals.total),
    totalGross: money(totals.total),
    extension: [
      insurance.insurer ? { url: INSURER_EXTENSION_URL, valueString: insurance.insurer } : undefined,
      { url: COVERAGE_EXTENSION_URL, valueInteger: insurance.coveragePercent },
      { url: PATIENT_SHARE_EXTENSION_URL, valueInteger: totals.patientShare },
    ].filter(Boolean),
  };
}

export function toPaymentNotice(invoiceId: string, amount: number, method: PaymentMethod, currency: string, receivedBy: string) {
  return {
    resourceType: "PaymentNotice",
    status: "active",
    request: { reference: `Invoice/${invoiceId}` },
    created: new Date().toISOString(),
    // R4 exige un lien vers un PaymentReconciliation ; on met un identifiant de reçu.
    payment: { identifier: { value: randomUUID() } },
    paymentDate: new Date().toISOString().slice(0, 10),
    recipient: { display: receivedBy },
    amount: { value: amount, currency },
    paymentStatus: { text: PAYMENT_METHOD_LABELS[method], coding: [{ system: "http://pediatrix.local/fhir/payment-method", code: method }] },
  };
}

interface FhirInvoice {
  id?: string;
  status?: string;
  date?: string;
  subject?: { reference?: string; display?: string };
  identifier?: { system?: string; value?: string }[];
  lineItem?: { chargeItemCodeableConcept?: { text?: string }; priceComponent?: { amount?: { value?: number } }[] }[];
  totalNet?: { value?: number; currency?: string };
  extension?: { url: string; valueString?: string; valueInteger?: number }[];
}

interface FhirPaymentNotice {
  request?: { reference?: string };
  amount?: { value?: number };
  created?: string;
  paymentStatus?: { coding?: { code?: string }[]; text?: string };
}

export interface InvoiceSummary {
  id: string;
  encounterId: string | null;
  patientId: string;
  patientName: string;
  date: string | null;
  status: "issued" | "balanced";
  currency: string;
  total: number;
  insurer: string | null;
  coveragePercent: number;
  insurerShare: number;
  patientShare: number;
  paid: number;
  balance: number;
  lines: { description: string; amount: number }[];
  payments: { amount: number; method: string; date: string | null }[];
}

export function summarizeInvoice(invoice: FhirInvoice, notices: FhirPaymentNotice[]): InvoiceSummary {
  const ext = (url: string) => invoice.extension?.find((e) => e.url === url);
  const total = invoice.totalNet?.value ?? 0;
  const patientShare = ext(PATIENT_SHARE_EXTENSION_URL)?.valueInteger ?? total;
  const coveragePercent = ext(COVERAGE_EXTENSION_URL)?.valueInteger ?? 0;
  const mine = notices.filter((n) => n.request?.reference === `Invoice/${invoice.id}`);
  const paid = mine.reduce((sum, n) => sum + (n.amount?.value ?? 0), 0);

  return {
    id: invoice.id ?? "",
    encounterId: invoice.identifier?.find((i) => i.system === INVOICE_ENCOUNTER_SYSTEM)?.value ?? null,
    patientId: invoice.subject?.reference?.split("/")[1] ?? "",
    patientName: invoice.subject?.display ?? "",
    date: invoice.date ?? null,
    status: invoice.status === "balanced" || Math.max(patientShare - paid, 0) === 0 ? "balanced" : "issued",
    currency: invoice.totalNet?.currency ?? "XOF",
    total,
    insurer: ext(INSURER_EXTENSION_URL)?.valueString ?? null,
    coveragePercent,
    insurerShare: total - patientShare,
    patientShare,
    paid,
    balance: Math.max(patientShare - paid, 0),
    lines: (invoice.lineItem ?? []).map((item) => ({
      description: item.chargeItemCodeableConcept?.text ?? "",
      amount: item.priceComponent?.[0]?.amount?.value ?? 0,
    })),
    payments: mine
      .map((n) => ({ amount: n.amount?.value ?? 0, method: n.paymentStatus?.coding?.[0]?.code ?? "", date: n.created ?? null }))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
  };
}

interface InvoiceIdentifiers {
  date?: string;
  identifier?: { system?: string; value?: string }[];
}

export interface BilledState {
  consultationBilled: boolean;
  sources: Set<string>;
  // Date de la dernière facture « ancienne » (sans suivi des éléments) : tout ce qui existait
  // à cette date est réputé facturé, pour ne pas facturer deux fois après une mise à jour.
  legacyCutoff?: string;
}

// État de facturation d'une consultation, d'après ses factures existantes.
export function billedState(invoices: InvoiceIdentifiers[]): BilledState {
  const sources = new Set<string>();
  let legacyCutoff: string | undefined;
  for (const invoice of invoices) {
    const own = (invoice.identifier ?? []).filter((i) => i.system === INVOICE_SOURCE_SYSTEM).map((i) => i.value ?? "");
    own.forEach((value) => sources.add(value));
    if (own.length === 0 && invoice.date && (!legacyCutoff || invoice.date > legacyCutoff)) legacyCutoff = invoice.date;
  }
  return { consultationBilled: invoices.length > 0, sources, legacyCutoff };
}

export function isBilled(state: BilledState, source: string, itemDate?: string): boolean {
  if (state.sources.has(source)) return true;
  return Boolean(state.legacyCutoff && itemDate && itemDate <= state.legacyCutoff);
}

// Éléments pas encore facturés d'une consultation : examens demandés et médicaments délivrés.
export function unbilledItems<S extends ServiceRequestLike, D extends DispenseLike>(
  state: BilledState,
  serviceRequests: S[],
  dispenses: D[],
): { serviceRequests: S[]; dispenses: D[] } {
  return {
    serviceRequests: serviceRequests.filter((sr) => !sr.id || !isBilled(state, `ServiceRequest/${sr.id}`, sr.authoredOn)),
    dispenses: dispenses.filter((d) => !d.id || !isBilled(state, `MedicationDispense/${d.id}`, d.whenHandedOver)),
  };
}
