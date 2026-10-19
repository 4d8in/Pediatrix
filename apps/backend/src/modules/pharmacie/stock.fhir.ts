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
  const extension = [
    input.lot ? { url: LOT_EXTENSION_URL, valueString: input.lot } : undefined,
    input.expiry ? { url: EXPIRY_EXTENSION_URL, valueDate: input.expiry } : undefined,
  ].filter(Boolean);

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
  quantity: number;
  reorderLevel: number;
  // Vrai quand le stock est sous le seuil de réapprovisionnement.
  low: boolean;
}

export function computeStock(receipts: QuantityResource[], dispenses: QuantityResource[]): StockLevel[] {
  const balance = new Map<string, number>();
  for (const receipt of receipts) {
    const code = itemCodeOf(receipt);
    if (code) balance.set(code, (balance.get(code) ?? 0) + quantityOf(receipt));
  }
  for (const dispense of dispenses) {
    const code = itemCodeOf(dispense);
    if (code) balance.set(code, (balance.get(code) ?? 0) - quantityOf(dispense));
  }

  return FORMULARY.map((item) => {
    const quantity = balance.get(item.code) ?? 0;
    return {
      code: item.code,
      name: item.name,
      form: item.form,
      unit: item.unit,
      quantity,
      reorderLevel: item.reorderLevel,
      low: quantity < item.reorderLevel,
    };
  });
}

export function stockOf(levels: StockLevel[], code: string): number {
  return levels.find((level) => level.code === code)?.quantity ?? 0;
}

export { findFormularyItem };
