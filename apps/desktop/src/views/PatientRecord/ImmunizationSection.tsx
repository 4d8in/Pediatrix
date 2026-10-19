import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Printer } from "lucide-react";
import { VaccinationCardSheet } from "../../components/print/PrintSheets";
import { useAuth } from "../../lib/auth-context";
import { usePrint } from "../../lib/print";
import { ApiError, createImmunization, getVaccinationSchedule, getVaccineCatalog } from "../../lib/api";
import type { Immunization, Patient, ScheduleItem, ScheduleStatus, Vaccine } from "../../lib/types";

const STATUS_STYLES: Record<ScheduleStatus, { label: string; className: string }> = {
  done: { label: "Fait", className: "border-green-200 bg-green-50 text-green-700" },
  due: { label: "À faire", className: "border-amber-200 bg-amber-50 text-amber-700" },
  overdue: { label: "En retard", className: "border-red-200 bg-red-50 text-red-700" },
  upcoming: { label: "À venir", className: "border-zinc-200 bg-zinc-50 text-zinc-500" },
};

export default function ImmunizationSection({
  patientId,
  patient,
  immunizations,
  onCreated,
}: {
  patientId: string;
  patient: Patient;
  immunizations: Immunization[];
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const { printDocument } = usePrint();
  const canWrite = user?.role === "doctor" || user?.role === "nurse";

  const [catalog, setCatalog] = useState<Vaccine[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [vaccine, setVaccine] = useState("");
  const [date, setDate] = useState("");
  const [doseNumber, setDoseNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadSchedule = useCallback(() => {
    getVaccinationSchedule(patientId)
      .then((data) => setSchedule(data.schedule))
      .catch(() => setSchedule([]));
  }, [patientId]);

  // Le catalogue sert de suggestion et le calendrier se recalcule à chaque vaccin enregistré.
  useEffect(() => {
    getVaccineCatalog()
      .then((data) => setCatalog(data.vaccines))
      .catch(() => setCatalog([]));
  }, []);
  useEffect(loadSchedule, [loadSchedule, immunizations]);

  // Un clic sur une dose du calendrier préremplit le formulaire.
  function fillFrom(item: ScheduleItem) {
    setVaccine(item.name);
    setDoseNumber(String(item.dose));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const entry = catalog.find((item) => item.name === vaccine.trim());
      await createImmunization(patientId, {
        vaccine,
        vaccineCode: entry?.code,
        date,
        doseNumber: doseNumber ? Number(doseNumber) : undefined,
      });
      setVaccine("");
      setDate("");
      setDoseNumber("");
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement du vaccin."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
      <div className="bg-white px-8 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-medium">Carnet vaccinal</h2>
        {immunizations.length > 0 && (
          <button
            type="button"
            data-testid="print-vaccination-card"
            onClick={() =>
              printDocument((facility) => (
                <VaccinationCardSheet facility={facility} patient={patient} immunizations={immunizations} />
              ))
            }
            className="flex items-center gap-2 text-xs font-medium text-[#1A6FD4] hover:underline"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimer le carnet
          </button>
        )}
      </div>

      {schedule.length > 0 && (
        <div className="border-b border-zinc-100 p-8" data-testid="vaccination-schedule">
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Calendrier recommandé</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-400">
              <tr>
                <th className="py-2 font-medium">Âge</th>
                <th className="py-2 font-medium">Vaccin</th>
                <th className="py-2 font-medium">Prévu le</th>
                <th className="py-2 font-medium">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {schedule.map((item) => (
                <tr
                  key={`${item.vaccine}-${item.dose}`}
                  onClick={canWrite && item.status !== "done" ? () => fillFrom(item) : undefined}
                  className={canWrite && item.status !== "done" ? "cursor-pointer hover:bg-zinc-50" : undefined}
                >
                  <td className="py-2 text-zinc-500">{item.label}</td>
                  <td className="py-2 text-zinc-900">
                    {item.name} — dose {item.dose}
                  </td>
                  <td className="py-2 text-zinc-500">{new Date(item.dueDate).toLocaleDateString("fr-FR")}</td>
                  <td className="py-2">
                    <span className={`rounded-xl border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status].className}`}>
                      {STATUS_STYLES[item.status].label}
                    </span>
                    {item.doneDate && (
                      <span className="ml-2 text-xs text-zinc-400">le {new Date(item.doneDate).toLocaleDateString("fr-FR")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-400">
            Calendrier d'exemple fondé sur le PEV : à adapter au calendrier national en vigueur.
          </p>
        </div>
      )}

      {canWrite && (
        <form onSubmit={handleSubmit} className="p-8 border-b border-zinc-100 space-y-6">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
              {errors.map((message) => (
                <p key={message} className="text-xs font-medium text-red-700">
                  {message}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Vaccin</label>
              <input
                type="text"
                required
                list="vaccine-catalog"
                value={vaccine}
                onChange={(event) => setVaccine(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : BCG"
              />
              <datalist id="vaccine-catalog">
                {catalog.map((item) => (
                  <option key={item.code} value={item.name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">Date</label>
              <input
                type="text"
                inputMode="numeric"
                required
                pattern="\d{4}-\d{2}-\d{2}"
                title="Format AAAA-MM-JJ"
                placeholder="AAAA-MM-JJ"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-400">
                Dose (optionnel)
              </label>
              <input
                type="number"
                min={1}
                value={doseNumber}
                onChange={(event) => setDoseNumber(event.target.value)}
                className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                placeholder="Ex. : 3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-10 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all disabled:opacity-50 rounded-full"
          >
            {isSubmitting ? "Enregistrement..." : "Ajouter au carnet"}
          </button>
        </form>
      )}

      {immunizations.length === 0 ? (
        <p className="p-10 text-sm text-zinc-400">
          Aucun vaccin enregistré.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {immunizations.map((immunization) => (
            <div key={immunization.id} className="p-8 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-900">
                  {immunization.vaccine ?? "Vaccin non précisé"}
                  {immunization.doseNumber ? ` — dose ${immunization.doseNumber}` : ""}
                </p>
                {immunization.notes && <p className="text-xs text-zinc-600">{immunization.notes}</p>}
              </div>
              <span className="text-sm text-zinc-400">
                {immunization.date ? new Date(immunization.date).toLocaleDateString("fr-FR") : "Date inconnue"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
