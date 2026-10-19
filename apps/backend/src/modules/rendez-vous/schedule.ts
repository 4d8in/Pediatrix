// Planning des consultations : créneaux réguliers sur les heures d'ouverture.
// Les heures sont celles de l'établissement ; le décalage avec UTC (en minutes,
// 0 pour le Sénégal) se règle avec HOSPITAL_UTC_OFFSET_MINUTES.
export interface ScheduleConfig {
  startHour: number;
  endHour: number;
  slotMinutes: number;
  utcOffsetMinutes: number;
}

export function scheduleConfig(env: NodeJS.ProcessEnv = process.env): ScheduleConfig {
  const read = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  return {
    startHour: read("APPOINTMENT_START_HOUR", 8),
    endHour: read("APPOINTMENT_END_HOUR", 17),
    slotMinutes: read("APPOINTMENT_SLOT_MINUTES", 20) || 20,
    utcOffsetMinutes: read("HOSPITAL_UTC_OFFSET_MINUTES", 0),
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// Début (UTC) de la journée locale `date`.
export function dayStartUtc(date: string, config: ScheduleConfig): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - config.utcOffsetMinutes * 60_000);
}

// Tous les créneaux de la journée, en ISO UTC.
export function daySlots(date: string, config: ScheduleConfig): string[] {
  const start = dayStartUtc(date, config).getTime() + config.startHour * 3_600_000;
  const end = dayStartUtc(date, config).getTime() + config.endHour * 3_600_000;
  const slots: string[] = [];
  for (let time = start; time + config.slotMinutes * 60_000 <= end; time += config.slotMinutes * 60_000) {
    slots.push(new Date(time).toISOString());
  }
  return slots;
}

// Créneaux encore libres : ni déjà réservés, ni déjà passés.
export function freeSlots(date: string, booked: string[], config: ScheduleConfig, now: Date = new Date()): string[] {
  const taken = new Set(booked.map((iso) => new Date(iso).toISOString()));
  return daySlots(date, config).filter((slot) => !taken.has(slot) && new Date(slot).getTime() > now.getTime());
}

export const APPOINTMENT_STATUSES = ["booked", "arrived", "fulfilled", "cancelled", "noshow"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

// Transitions permises : on ne rouvre pas un rendez-vous terminé ou annulé.
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ["arrived", "cancelled", "noshow"],
  arrived: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
  noshow: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
