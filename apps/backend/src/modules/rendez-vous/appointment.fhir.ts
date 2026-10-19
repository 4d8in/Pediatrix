import type { AppointmentStatus } from "./schedule.js";

export interface AppointmentSummary {
  id: string;
  status: AppointmentStatus;
  start: string;
  end: string | null;
  reason: string | null;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
}

export function toFhirAppointment(
  patient: { id: string; name: string },
  practitioner: { id: string; name: string },
  start: string,
  minutes: number,
  reason: string,
) {
  const end = new Date(new Date(start).getTime() + minutes * 60_000).toISOString();
  return {
    resourceType: "Appointment",
    status: "booked",
    description: reason,
    start,
    end,
    minutesDuration: minutes,
    created: new Date().toISOString(),
    participant: [
      { actor: { reference: `Patient/${patient.id}`, display: patient.name }, status: "accepted" },
      { actor: { reference: `Practitioner/${practitioner.id}`, display: practitioner.name }, status: "accepted" },
    ],
  };
}

interface FhirAppointment {
  id?: string;
  status?: string;
  description?: string;
  start?: string;
  end?: string;
  participant?: { actor?: { reference?: string; display?: string } }[];
}

export function summarizeAppointment(appointment: FhirAppointment): AppointmentSummary {
  const actor = (type: string) => appointment.participant?.map((p) => p.actor).find((a) => a?.reference?.startsWith(`${type}/`));
  const patient = actor("Patient");
  const practitioner = actor("Practitioner");
  return {
    id: appointment.id ?? "",
    status: (appointment.status as AppointmentStatus) ?? "booked",
    start: appointment.start ?? "",
    end: appointment.end ?? null,
    reason: appointment.description ?? null,
    patientId: patient?.reference?.split("/")[1] ?? "",
    patientName: patient?.display ?? "",
    practitionerId: practitioner?.reference?.split("/")[1] ?? "",
    practitionerName: practitioner?.display ?? "",
  };
}
