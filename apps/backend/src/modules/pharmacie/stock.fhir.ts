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

interface ReceiptResource extends QuantityResource {
  extension?: { url: string; valueDate?: string; valueString?: string }[];
}

function expiryOf(receipt: ReceiptResource): string | undefined {
  return receipt.extension?.find((e) => e.url === EXPIRY_EXTENSION_URL)?.valueDate;
}

// Stock par article avec gestion des péremptions : les délivrances consomment d'abord
// les lots qui périment le plus tôt (FEFO). Ce qui reste dans un lot périmé n'est plus
// utilisable. Un lot sans date de péremption n'expire jamais (et est consommé en dernier).
export function computeStock(
  receipts: ReceiptResource[],
  dispenses: QuantityResource[],
  now: Date = new Date(),
): StockLevel[] {
  const today = now.toISOString().slice(0, 10);
  const warning = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000).toISOString().slice(0, 10);

  const lotsByItem = new Map<string, { expiry?: string; remaining: number }[]>();
  for (const receipt of receipts) {
    const code = itemCodeOf(receipt);
    if (!code) continue;
    const lots = lotsByItem.get(code) ?? [];
    lots.push({ expiry: expiryOf(receipt), remaining: quantityOf(receipt) });
    lotsByItem.set(code, lots);
  }

  const dispensedByItem = new Map<string, number>();
  for (const dispense of dispenses) {
    const code = itemCodeOf(dispense);
    if (code) dispensedByItem.set(code, (dispensedByItem.get(code) ?? 0) + quantityOf(dispense));
  }

  return FORMULARY.map((item) => {
    const lots = [...(lotsByItem.get(item.code) ?? [])].sort((a, b) =>
      a.expiry === b.expiry ? 0 : a.expiry === undefined ? 1 : b.expiry === undefined ? -1 : a.expiry.localeCompare(b.expiry),
    );
    let toConsume = dispensedByItem.get(item.code) ?? 0;
    for (const lot of lots) {
      const taken = Math.min(lot.remaining, toConsume);
      lot.remaining -= taken;
      toConsume -= taken;
    }
    // Ce qui dépasse le total reçu (délivrance sans réception) donne un stock négatif, comme avant.
    const overdraw = toConsume;

    let usable = 0 - overdraw + 0;
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
