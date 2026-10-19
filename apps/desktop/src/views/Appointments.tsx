import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import {
  ApiError,
  createAppointment,
  listAppointmentSlots,
  listAppointments,
  listDoctors,
  updateAppointmentStatus,
} from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { LOCALES, useI18n } from "../lib/i18n";
import type { Appointment, AppointmentStatus, DoctorOption, Patient } from "../lib/types";

const STATUS_LABELS: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: { label: "Prévu", className: "border-blue-200 bg-blue-50 text-blue-700" },
  arrived: { label: "Arrivé", className: "border-amber-200 bg-amber-50 text-amber-700" },
  fulfilled: { label: "Terminé", className: "border-green-200 bg-green-50 text-green-700" },
  cancelled: { label: "Annulé", className: "border-zinc-200 bg-zinc-50 text-zinc-500" },
  noshow: { label: "Absent", className: "border-red-200 bg-red-50 text-red-700" },
};

const inputClass =
  "w-full bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs focus:outline-none focus:border-[#1A6FD4] rounded-xl";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function timeOf(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function errorText(error: unknown, t: (fr: string) => string): string[] {
  if (error instanceof ApiError) return error.details ?? [error.message];
  return [t("Erreur inattendue.")];
}

export default function Appointments() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const canBook = user?.role === "receptionist" || user?.role === "nurse";
  const isDoctor = user?.role === "doctor";

  const [date, setDate] = useState(today());
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [filterDoctor, setFilterDoctor] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [bookDoctor, setBookDoctor] = useState("");
  const [bookDate, setBookDate] = useState(today());
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [bookErrors, setBookErrors] = useState<string[]>([]);
  const [booked, setBooked] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    listAppointments(date, filterDoctor || undefined)
      .then((data) => setAppointments(data.appointments))
      .catch((error) => setLoadError(errorText(error, t).join(" ")))
      .finally(() => setIsLoading(false));
  }, [date, filterDoctor, t]);

  useEffect(load, [load]);

  useEffect(() => {
    listDoctors()
      .then((data) => setDoctors(data.doctors))
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    setSlot("");
    if (!bookDoctor) {
      setSlots([]);
      return;
    }
    listAppointmentSlots(bookDate, bookDoctor)
      .then((data) => setSlots(data.slots))
      .catch(() => setSlots([]));
  }, [bookDoctor, bookDate, booked]);

  async function handleBook(event: FormEvent) {
    event.preventDefault();
    if (!patient) {
      setBookErrors([t("Choisissez un patient.")]);
      return;
    }
    setBookErrors([]);
    try {
      await createAppointment({ patientId: patient.id, practitionerId: bookDoctor, start: slot, reason });
      setPatient(null);
      setReason("");
      setBooked((value) => !value);
      if (bookDate === date) load();
    } catch (error) {
      setBookErrors(errorText(error, t));
    }
  }

  async function handleStatus(appointment: Appointment, status: AppointmentStatus) {
    setActionError(null);
    try {
      await updateAppointmentStatus(appointment.id, status);
      load();
    } catch (error) {
      setActionError(errorText(error, t).join(" "));
    }
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-zinc-900">{t("Rendez-vous")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isDoctor ? t("Votre agenda") : t("Agenda des consultations et prise de rendez-vous")}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> {t("Actualiser")}
        </button>
      </div>

      <div className="flex min-h-[460px] flex-1 gap-4">
        <div className="flex flex-1 flex-col gap-3 rounded-[18px] border border-zinc-200/70 bg-white p-6">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              data-testid="agenda-date"
              className={`${inputClass} w-44`}
            />
            {!isDoctor && (
              <select value={filterDoctor} onChange={(event) => setFilterDoctor(event.target.value)} className={`${inputClass} w-56`}>
                <option value="">{t("Tous les médecins")}</option>
                {doctors.map((doctor) => (
                  <option key={doctor.practitionerId} value={doctor.practitionerId}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          {appointments.length === 0 && !loadError && (
            <div className="flex flex-1 flex-col items-center justify-center text-center opacity-30">
              <CalendarDays className="mb-3 h-12 w-12" />
              <p className="text-sm font-medium">{t("Aucun rendez-vous ce jour")}</p>
            </div>
          )}
          <div className="divide-y divide-zinc-50 overflow-y-auto">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="w-14 text-sm font-medium text-zinc-900">{timeOf(appointment.start, LOCALES[lang])}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{appointment.patientName || t("Patient inconnu")}</p>
                    <p className="text-xs text-zinc-500">
                      {appointment.reason} · {appointment.practitionerName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-xl border px-2 py-0.5 text-xs font-medium ${STATUS_LABELS[appointment.status].className}`}>
                    {t(STATUS_LABELS[appointment.status].label)}
                  </span>
                  {canBook && appointment.status === "booked" && (
                    <>
                      <button
                        onClick={() => handleStatus(appointment, "arrived")}
                        data-testid="appointment-arrived"
                        className="text-xs font-medium text-[#1A6FD4] hover:underline"
                      >
                        {t("Arrivé")}
                      </button>
                      <button onClick={() => handleStatus(appointment, "noshow")} className="text-xs text-zinc-500 hover:underline">
                        {t("Absent")}
                      </button>
                    </>
                  )}
                  {canBook && (appointment.status === "booked" || appointment.status === "arrived") && (
                    <button onClick={() => handleStatus(appointment, "cancelled")} className="text-xs text-red-600 hover:underline">
                      {t("Annuler")}
                    </button>
                  )}
                  {isDoctor && appointment.status === "arrived" && (
                    <button
                      onClick={() => handleStatus(appointment, "fulfilled")}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      {t("Terminer")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {canBook && (
          <form onSubmit={handleBook} className="w-[360px] space-y-4 rounded-[18px] border border-zinc-200/70 bg-white p-6">
            <h2 className="text-sm font-medium text-zinc-900">{t("Nouveau rendez-vous")}</h2>
            {bookErrors.length > 0 && (
              <div className="space-y-1 rounded-[18px] border border-red-200 bg-red-50 p-3">
                {bookErrors.map((message) => (
                  <p key={message} className="text-xs font-medium text-red-700">
                    {message}
                  </p>
                ))}
              </div>
            )}
            <PatientPicker selected={patient} onSelect={setPatient} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Médecin")}</label>
              <select required data-testid="book-doctor" value={bookDoctor} onChange={(event) => setBookDoctor(event.target.value)} className={inputClass}>
                <option value="">{t("Choisir…")}</option>
                {doctors.map((doctor) => (
                  <option key={doctor.practitionerId} value={doctor.practitionerId}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Jour")}</label>
              <input type="date" value={bookDate} min={today()} onChange={(event) => setBookDate(event.target.value)} className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Créneau")}</label>
              <select required data-testid="book-slot" value={slot} onChange={(event) => setSlot(event.target.value)} className={inputClass}>
                <option value="">{bookDoctor ? (slots.length ? t("Choisir…") : t("Aucun créneau libre")) : t("Choisissez un médecin")}</option>
                {slots.map((item) => (
                  <option key={item} value={item}>
                    {timeOf(item, LOCALES[lang])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">{t("Motif")}</label>
              <input required data-testid="book-reason" value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
            </div>
            <button
              type="submit"
              data-testid="book-submit"
              className="w-full rounded-full bg-[#1A6FD4] px-6 py-3 text-xs font-medium text-white hover:bg-[#155bb0]"
            >
              {t("Réserver")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
