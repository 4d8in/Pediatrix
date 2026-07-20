import type { VitalKey } from "../../lib/vitals-codes.js";

export type VitalsInput = Partial<Record<VitalKey, number>>;

export interface CreateEncounterInput {
  reason: string;
  notes?: string;
  vitals: VitalsInput;
}
