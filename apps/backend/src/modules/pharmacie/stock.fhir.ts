import { FORMULARY, FORMULARY_SYSTEM, type FormularyItem, findFormularyItem } from "../../lib/formulary.js";

// Le stock n'est pas stocké : il se déduit des mouvements FHIR (même principe
// qu'un journal comptable). Réception = SupplyDelivery ; délivrance =
// MedicationDispense. Stock d'un article = somme des réceptions - somme des délivrances.
export const LOT_EXTENSION_URL = "http://pediatrix.local/fhir/stock-lot";
export const EXPIRY_EXTENSION_URL = "http://pediatrix.local/fhir/stock-expiry";

export interface ReceiptInput {
  itemCode: string;
  quantity: number;
  lot?: string;
  expiry?: string;
}

export function toSupplyDelivery(item: FormularyItem, input: ReceiptInput, receivedBy: string) {
  const extension: { url: string; valueString?: string; valueDate?: string }[] = [];
  if (input.lot) extension.push({ url: LOT_EXTENSION_URL, valueString: input.lot });
  if (input.expiry) extension.push({ url: EXPIRY_EXTENSION_URL, valueDate: input.expiry });

  return {
    resourceType: "SupplyDelivery",
    status: "completed",
    suppliedItem: {
      quantity: { value: input.quantity, unit: item.unit },
      itemCodeableConcept: { coding: [{ system: FORMULARY_SYSTEM, code: item.code, display: item.name }], text: item.name },
    },
    occurrenceDateTime: new Date().toISOString(),
    receiver: { display: receivedBy },
    extension: extension.length > 0 ? extension : undefined,
  };
}

export function toMedicationDispense(
  item: FormularyItem,
  quantity: number,
  medicationRequestId: string,
  patientReference: string,
  encounterReference: string | undefined,
  dispensedBy: string,
) {
  return {
    resourceType: "MedicationDispense",
    status: "completed",
    medicationCodeableConcept: { coding: [{ system: FORMULARY_SYSTEM, code: item.code, display: item.name }], text: item.name },
    subject: { reference: patientReference },
    context: encounterReference ? { reference: encounterReference } : undefined,
    authorizingPrescription: [{ reference: `MedicationRequest/${medicationRequestId}` }],
    quantity: { value: quantity, unit: item.unit },
    whenHandedOver: new Date().toISOString(),
    performer: [{ actor: { display: dispensedBy } }],
  };
}

interface QuantityResource {
  suppliedItem?: { quantity?: { value?: number }; itemCodeableConcept?: { coding?: { code?: string }[] } };
  medicationCodeableConcept?: { coding?: { code?: string }[] };
  quantity?: { value?: number };
}

function itemCodeOf(resource: QuantityResource): string | undefined {
  return (resource.suppliedItem?.itemCodeableConcept ?? resource.medicationCodeableConcept)?.coding?.[0]?.code;
}

function quantityOf(resource: QuantityResource): number {
  return resource.suppliedItem?.quantity?.value ?? resource.quantity?.value ?? 0;
}

export interface StockLevel {
  code: string;
  name: string;
  form: string;
  unit: string;
  // Quantité utilisable : le stock en main moins les lots périmés.
  quantity: number;
  reorderLevel: number;
  // Vrai quand la quantité utilisable est sous le seuil de réapprovisionnement.
  low: boolean;
  // Quantité restante dans des lots dont la péremption est dépassée (à retirer).
  expiredQuantity: number;
  // Quantité restante dans des lots qui périment dans EXPIRY_WARNING_DAYS jours ou moins.
  expiringSoonQuantity: number;
}

export const EXPIRY_WARNING_DAYS = 90;

interface TimedQuantityResource extends QuantityResource {
  whenHandedOver?: string;
}

interface ReceiptResource extends QuantityResource {
  occurrenceDateTime?: string;
  extension?: { url: string; valueDate?: string; valueString?: string }[];
}

function expiryOf(receipt: ReceiptResource): string | undefined {
  return receipt.extension?.find((e) => e.url === EXPIRY_EXTENSION_URL)?.valueDate;
}

// Stock par article avec gestion des péremptions, calculé en rejouant les mouvements
// dans l'ordre chronologique : à chaque délivrance, on prélève d'abord dans les lots déjà
// reçus à cette date, non périmés à cette date, qui périment le plus tôt (FEFO). Ce qui
// reste à `now` dans un lot périmé n'est plus utilisable. Un lot sans date de péremption
// n'expire jamais (et est consommé en dernier). Une délivrance sans lot disponible creuse
// un stock négatif, comme avant.
export function computeStock(
  receipts: ReceiptResource[],
  dispenses: TimedQuantityResource[],
  now: Date = new Date(),
): StockLevel[] {
  const today = now.toISOString().slice(0, 10);
  const warning = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10);

  type Lot = { expiry?: string; remaining: number };
  type Event =
    | { at: string; kind: "receipt"; lot: Lot }
    | { at: string; kind: "dispense"; quantity: number };
  const eventsByItem = new Map<string, Event[]>();
  const push = (code: string, event: Event) => {
    const list = eventsByItem.get(code) ?? [];
    list.push(event);
    eventsByItem.set(code, list);
  };
  for (const receipt of receipts) {
    const code = itemCodeOf(receipt);
    if (code) push(code, { at: receipt.occurrenceDateTime ?? "", kind: "receipt", lot: { expiry: expiryOf(receipt), remaining: quantityOf(receipt) } });
  }
  for (const dispense of dispenses) {
    const code = itemCodeOf(dispense);
    if (code) push(code, { at: dispense.whenHandedOver ?? "", kind: "dispense", quantity: quantityOf(dispense) });
  }

  return FORMULARY.map((item) => {
    // À date égale, les réceptions passent avant les délivrances.
    const events = (eventsByItem.get(item.code) ?? []).sort(
      (x, y) => x.at.localeCompare(y.at) || (x.kind === y.kind ? 0 : x.kind === "receipt" ? -1 : 1),
    );
    const lots: Lot[] = [];
    let overdraw = 0;
    for (const event of events) {
      if (event.kind === "receipt") {
        lots.push(event.lot);
        continue;
      }
      const day = event.at.slice(0, 10);
      const candidates = lots
        .filter((lot) => lot.remaining > 0 && (lot.expiry === undefined || lot.expiry >= day))
        .sort((x, y) => (x.expiry === y.expiry ? 0 : x.expiry === undefined ? 1 : y.expiry === undefined ? -1 : x.expiry.localeCompare(y.expiry)));
      let toTake = event.quantity;
      for (const lot of candidates) {
        const taken = Math.min(lot.remaining, toTake);
        lot.remaining -= taken;
        toTake -= taken;
        if (toTake === 0) break;
      }
      overdraw += toTake;
    }

    let usable = 0 - overdraw;
    let expired = 0;
    let expiringSoon = 0;
    for (const lot of lots) {
      if (lot.expiry !== undefined && lot.expiry < today) expired += lot.remaining;
      else {
        usable += lot.remaining;
        if (lot.expiry !== undefined && lot.expiry <= warning) expiringSoon += lot.remaining;
      }
    }
    return {
      code: item.code,
      name: item.name,
      form: item.form,
      unit: item.unit,
      quantity: usable === 0 ? 0 : usable,
      reorderLevel: item.reorderLevel,
      low: usable < item.reorderLevel,
      expiredQuantity: expired,
      expiringSoonQuantity: expiringSoon,
    };
  });
}

export function stockOf(levels: StockLevel[], code: string): number {
  return levels.find((level) => level.code === code)?.quantity ?? 0;
}

export { findFormularyItem };
