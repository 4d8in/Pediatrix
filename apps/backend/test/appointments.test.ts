import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeAppointment, toFhirAppointment } from "../src/modules/rendez-vous/appointment.fhir.js";
import {
  canTransition,
  dayStartUtc,
  daySlots,
  freeSlots,
  isValidDate,
  scheduleConfig,
} from "../src/modules/rendez-vous/schedule.js";

const config = { startHour: 8, endHour: 17, slotMinutes: 20, utcOffsetMinutes: 0 };

test("une journée de 8 h à 17 h en créneaux de 20 min compte 27 créneaux, le dernier à 16 h 40", () => {
  const slots = daySlots("2026-11-02", config);
  assert.equal(slots.length, 27);
  assert.equal(slots[0], "2026-11-02T08:00:00.000Z");
  assert.equal(slots.at(-1), "2026-11-02T16:40:00.000Z");
});

test("le décalage horaire de l'établissement déplace les créneaux", () => {
  const plus1 = { ...config, utcOffsetMinutes: 60 }; // UTC+1 : 8 h locales = 7 h UTC
  assert.equal(daySlots("2026-11-02", plus1)[0], "2026-11-02T07:00:00.000Z");
  assert.equal(dayStartUtc("2026-11-02", plus1).toISOString(), "2026-11-01T23:00:00.000Z");
});

test("les créneaux libres excluent les réservés et ceux déjà passés", () => {
  const now = new Date("2026-11-02T09:00:00.000Z");
  const libres = freeSlots("2026-11-02", ["2026-11-02T09:20:00.000Z"], config, now);
  assert.equal(libres.includes("2026-11-02T08:40:00.000Z"), false); // passé
  assert.equal(libres.includes("2026-11-02T09:00:00.000Z"), false); // maintenant, déjà commencé
  assert.equal(libres.includes("2026-11-02T09:20:00.000Z"), false); // réservé
  assert.equal(libres.includes("2026-11-02T09:40:00.000Z"), true);
});

test("les transitions de statut interdisent de rouvrir un rendez-vous clos", () => {
  assert.equal(canTransition("booked", "arrived"), true);
  assert.equal(canTransition("arrived", "fulfilled"), true);
  assert.equal(canTransition("booked", "fulfilled"), false);
  assert.equal(canTransition("cancelled", "booked"), false);
  assert.equal(canTransition("fulfilled", "cancelled"), false);
});

test("la configuration lit l'environnement et retombe sur des valeurs par défaut", () => {
  assert.deepEqual(scheduleConfig({}), config);
  assert.equal(scheduleConfig({ APPOINTMENT_SLOT_MINUTES: "30", HOSPITAL_UTC_OFFSET_MINUTES: "60" }).slotMinutes, 30);
  assert.equal(scheduleConfig({ APPOINTMENT_SLOT_MINUTES: "abc" }).slotMinutes, 20);
});

test("isValidDate refuse un format ou un jour impossible", () => {
  assert.equal(isValidDate("2026-11-02"), true);
  assert.equal(isValidDate("2026-13-40"), false);
  assert.equal(isValidDate("02/11/2026"), false);
});

test("un rendez-vous FHIR relu donne patient, médecin, heure et motif", () => {
  const fhir = {
    ...toFhirAppointment({ id: "p1", name: "Awa Diallo" }, { id: "d1", name: "Dr. Sall" }, "2026-11-02T09:00:00.000Z", 20, "Fièvre"),
    id: "a1",
  };
  const summary = summarizeAppointment(fhir);
  assert.equal(summary.patientName, "Awa Diallo");
  assert.equal(summary.practitionerId, "d1");
  assert.equal(summary.end, "2026-11-02T09:20:00.000Z");
  assert.equal(summary.reason, "Fièvre");
  assert.equal(summary.status, "booked");
});
