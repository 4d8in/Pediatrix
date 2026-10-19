import { fetchAll } from "../../lib/fhir-search.js";
import { type AppointmentSummary, summarizeAppointment } from "./appointment.fhir.js";
import { type ScheduleConfig, dayStartUtc } from "./schedule.js";

// Rendez-vous d'une journée locale (tous statuts), éventuellement pour un seul médecin.
export async function readDayAppointments(
  date: string,
  config: ScheduleConfig,
  practitionerId?: string,
): Promise<AppointmentSummary[]> {
  const start = dayStartUtc(date, config);
  const end = new Date(start.getTime() + 86_400_000);
  const actor = practitionerId ? `&actor=Practitioner/${practitionerId}` : "";
  const resources = await fetchAll<Record<string, unknown>>(
    `/Appointment?date=ge${start.toISOString()}&date=lt${end.toISOString()}${actor}&_sort=date`,
  );
  return resources.map((r) => summarizeAppointment(r as never));
}
