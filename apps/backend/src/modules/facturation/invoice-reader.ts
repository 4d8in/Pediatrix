import { fetchAll } from "../../lib/fhir-search.js";
import { hapiClient } from "../../lib/hapi-client.js";
import { type InvoiceSummary, summarizeInvoice } from "./billing.fhir.js";

type Json = Record<string, unknown>;

export async function readInvoice(id: string): Promise<InvoiceSummary> {
  const [invoice, notices] = await Promise.all([
    hapiClient.get<Json>(`/Invoice/${id}`, { "Cache-Control": "no-cache" }),
    fetchAll<Json>(`/PaymentNotice?request=Invoice/${id}`),
  ]);
  return summarizeInvoice(invoice as never, notices as never);
}

export async function readAllInvoices(): Promise<InvoiceSummary[]> {
  const [invoices, notices] = await Promise.all([fetchAll<Json>("/Invoice?_sort=-date"), fetchAll<Json>("/PaymentNotice")]);
  return invoices.map((invoice) => summarizeInvoice(invoice as never, notices as never));
}
