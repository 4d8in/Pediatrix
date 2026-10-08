import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Pill, ScanLine } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import VitalsFields from "./VitalsFields";
import {
  ApiError,
  createEncounter,
  createImagingRequest,
  createPrescription,
  createServiceRequest,
  getPatient,
} from "../lib/api";
import type { AllergyConflict, Patient, Vitals } from "../lib/types";

interface ConsultationsProps {
  initialPatientId?: string | null;
}

export default function Consultations({ initialPatientId }: ConsultationsProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientLoadError, setPatientLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [vitals, setVitals] = useState<Vitals>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [encounterId, setEncounterId] = useState<string | null>(null);

  const [exam, setExam] = useState("");
  const [requester, setRequester] = useState("");
  const [isRequestingExam, setIsRequestingExam] = useState(false);
  const [examErrors, setExamErrors] = useState<string[]>([]);
  const [examRequested, setExamRequested] = useState(false);

  const [imagingExam, setImagingExam] = useState("");
  const [imagingRequester, setImagingRequester] = useState("");
  const [isRequestingImaging, setIsRequestingImaging] = useState(false);
  const [imagingErrors, setImagingErrors] = useState<string[]>([]);
  const [imagingRequested, setImagingRequested] = useState(false);

  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescriptionErrors, setPrescriptionErrors] = useState<string[]>([]);
  const [allergyConflict, setAllergyConflict] = useState<AllergyConflict | null>(null);
  const [prescriptionCreated, setPrescriptionCreated] = useState(false);

  function resetForm() {
    setPatient(null);
    setReason("");
    setNotes("");
    setVitals({});
    setEncounterId(null);
    setExam("");
    setRequester("");
    setExamErrors([]);
    setExamRequested(false);
    setImagingExam("");
    setImagingRequester("");
    setImagingErrors([]);
    setImagingRequested(false);
    setMedication("");
    setDosage("");
    setPrescriptionErrors([]);
    setAllergyConflict(null);
    setPrescriptionCreated(false);
  }

  // Reçoit un patient présélectionné (venant du bouton « Saisir paramètres
  // vitaux » du Dashboard) : le formulaire se pré-remplit directement, sans
  // passer par PatientPicker. Celui-ci reste disponible pour en choisir un autre.
  useEffect(() => {
    if (!initialPatientId) return;
    let cancelled = false;
    getPatient(initialPatientId)
      .then((data) => {
        if (!cancelled) setPatient(data.patient);
      })
      .catch((err) => {
        if (!cancelled) setPatientLoadError(err instanceof ApiError ? err.message : "Erreur de chargement du patient.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patient) return;

    setErrors([]);
    setIsSubmitting(true);

    try {
      const { encounterId } = await createEncounter(patient.id, { reason, notes: notes || undefined, vitals });
      setEncounterId(encounterId);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? [error.message]);
      } else {
        setErrors(["Erreur inattendue lors de l'enregistrement de la consultation."]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestExam(event: FormEvent) {
    event.preventDefault();
    if (!encounterId) return;

    setExamErrors([]);
    setIsRequestingExam(true);

    try {
      await createServiceRequest(encounterId, { exam, requester });
      setExamRequested(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setExamErrors(error.details ?? [error.message]);
      } else {
        setExamErrors(["Erreur inattendue lors de la demande d'examen."]);
      }
    } finally {
      setIsRequestingExam(false);
    }
  }

  async function handleRequestImaging(event: FormEvent) {
    event.preventDefault();
    if (!encounterId) return;

    setImagingErrors([]);
    setIsRequestingImaging(true);

    try {
      await createImagingRequest(encounterId, { exam: imagingExam, requester: imagingRequester });
      setImagingRequested(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setImagingErrors(error.details ?? [error.message]);
      } else {
        setImagingErrors(["Erreur inattendue lors de la demande d'imagerie."]);
      }
    } finally {
      setIsRequestingImaging(false);
    }
  }

  async function submitPrescription(confirmed: boolean) {
    if (!encounterId) return;

    setPrescriptionErrors([]);
    setIsPrescribing(true);

    try {
      await createPrescription(encounterId, { medication, dosage, confirmed });
      setAllergyConflict(null);
      setPrescriptionCreated(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const body = error.body as Partial<AllergyConflict> | undefined;
        if (body?.requiresConfirmation) {
          setAllergyConflict({
            requiresConfirmation: true,
            allergy: body.allergy ?? "",
            message: body.message ?? error.message,
          });
          return;
        }
      }
      if (error instanceof ApiError) {
        setPrescriptionErrors(error.details ?? [error.message]);
      } else {
        setPrescriptionErrors(["Erreur inattendue lors de l'enregistrement de la prescription."]);
      }
    } finally {
      setIsPrescribing(false);
    }
  }

  async function handleSubmitPrescription(event: FormEvent) {
    event.preventDefault();
    await submitPrescription(false);
  }

  async function handleConfirmDespiteAllergy() {
    await submitPrescription(true);
  }

  if (encounterId) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-white border border-zinc-200/70 overflow-hidden rounded-[18px]">
          <div className="bg-green-500 p-8 flex flex-col items-center text-white space-y-4">
            <CheckCircle2 className="w-16 h-16" />
            <h2 className="text-xl font-medium">Consultation enregistrée</h2>
          </div>

          <div className="p-10 space-y-8">
            {examRequested ? (
              <div className="bg-zinc-50 border border-zinc-200/70 p-6 flex items-center gap-4 rounded-[18px]">
                <FlaskConical className="w-6 h-6 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-700">
                  Examen demandé — le laboratoire a été notifié.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestExam} className="space-y-6">
                <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" /> Demander un examen
                </h3>

                {examErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
                    {examErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Examen demandé
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="exam-request-exam"
                    value={exam}
                    onChange={(event) => setExam(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Numération Formule Sanguine"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Demandeur
                  </label>
                  <input
                    type="text"
                    required
                    data-testid="exam-request-requester"
                    value={requester}
                    onChange={(event) => setRequester(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Dr. Moussa Diallo"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRequestingExam}
                  className="w-full bg-[#1A6FD4] text-white px-6 py-4 text-sm font-medium hover:bg-[#1559ab] transition-all disabled:opacity-50 rounded-full"
                >
                  {isRequestingExam ? "Envoi..." : "Envoyer au laboratoire"}
                </button>
              </form>
            )}

            {imagingRequested ? (
              <div className="bg-zinc-50 border border-zinc-200/70 p-6 flex items-center gap-4 rounded-[18px]">
                <ScanLine className="w-6 h-6 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-700">
                  Imagerie demandée — la radiologie a été notifiée.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestImaging} className="space-y-6">
                <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <ScanLine className="w-4 h-4" /> Demander une imagerie
                </h3>

                {imagingErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
                    {imagingErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Examen d'imagerie demandé
                  </label>
                  <input
                    type="text"
                    required
                    value={imagingExam}
                    onChange={(event) => setImagingExam(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Radiographie thoracique"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Demandeur
                  </label>
                  <input
                    type="text"
                    required
                    value={imagingRequester}
                    onChange={(event) => setImagingRequester(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Dr. Moussa Diallo"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRequestingImaging}
                  className="w-full bg-[#1A6FD4] text-white px-6 py-4 text-sm font-medium hover:bg-[#1559ab] transition-all disabled:opacity-50 rounded-full"
                >
                  {isRequestingImaging ? "Envoi..." : "Envoyer à la radiologie"}
                </button>
              </form>
            )}

            {prescriptionCreated ? (
              <div className="bg-zinc-50 border border-zinc-200/70 p-6 flex items-center gap-4 rounded-[18px]">
                <Pill className="w-6 h-6 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-700">
                  Prescription enregistrée.
                </p>
              </div>
            ) : allergyConflict ? (
              <div className="bg-red-50 border border-red-200 p-6 space-y-4 rounded-[18px]">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="text-sm font-medium text-red-700">
                    Allergie connue
                  </h3>
                </div>
                <p className="text-xs font-medium text-red-700">{allergyConflict.message}</p>

                {prescriptionErrors.length > 0 && (
                  <div className="space-y-2">
                    {prescriptionErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setAllergyConflict(null)}
                    className="flex-1 bg-white border border-zinc-300 text-zinc-700 px-6 py-3 text-sm font-medium hover:bg-zinc-50 transition-all rounded-[18px]"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDespiteAllergy}
                    disabled={isPrescribing}
                    className="flex-1 bg-red-600 text-white px-6 py-3 text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {isPrescribing ? "Envoi..." : "Confirmer et prescrire quand même"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPrescription} className="space-y-6">
                <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Pill className="w-4 h-4" /> Prescrire un médicament
                </h3>

                {prescriptionErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
                    {prescriptionErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Médicament
                  </label>
                  <input
                    type="text"
                    required
                    value={medication}
                    onChange={(event) => setMedication(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Amoxicilline"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Posologie
                  </label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(event) => setDosage(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : 5ml x 3/j pendant 7 jours"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPrescribing}
                  className="w-full bg-[#1A6FD4] text-white px-6 py-4 text-sm font-medium hover:bg-[#1559ab] transition-all disabled:opacity-50 rounded-full"
                >
                  {isPrescribing ? "Envoi..." : "Enregistrer la prescription"}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={resetForm}
              className="w-full bg-[#1A6FD4] text-white px-6 py-4 text-sm font-medium hover:bg-[#155bb0] transition-all rounded-full"
            >
              Nouvelle consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="pb-2">
        <h1 className="text-[22px] font-medium text-zinc-900 mb-1">Consultation</h1>
        <p className="text-sm text-zinc-400 font-medium">
          Service Pédiatrie — Motif, notes cliniques et paramètres vitaux
        </p>
      </div>

      <form className="space-y-10 pb-20" onSubmit={handleSubmit}>
        {patientLoadError && (
          <div className="bg-red-50 border border-red-200 p-6 rounded-[18px]">
            <p className="text-xs font-medium text-red-700">{patientLoadError}</p>
          </div>
        )}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-6 space-y-2 rounded-[18px]">
            {errors.map((message) => (
              <p key={message} className="text-xs font-medium text-red-700">
                {message}
              </p>
            ))}
          </div>
        )}

        <section className="bg-white border border-zinc-200/70 overflow-hidden p-10 rounded-[18px]">
          <PatientPicker selected={patient} onSelect={setPatient} />
        </section>

        <section className="bg-white border border-zinc-200/70 overflow-hidden p-10 space-y-8 rounded-[18px]">
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-400">
              Motif de consultation
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
              placeholder="Ex. : fièvre persistante depuis 3 jours"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-400">
              Notes cliniques
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs resize-none rounded-xl"
              placeholder="Observations, examen clinique..."
            />
          </div>
        </section>

        <section className="bg-white border border-zinc-200/70 overflow-hidden p-10 rounded-[18px]">
          <h2 className="text-sm font-medium mb-8">Paramètres vitaux</h2>
          <VitalsFields vitals={vitals} onChange={setVitals} />
        </section>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !patient}
            className="px-10 py-3 bg-[#1A6FD4] text-white text-sm font-medium hover:bg-[#155bb0] transition-all disabled:opacity-50 rounded-full"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer la consultation"}
          </button>
        </div>
      </form>
    </div>
  );
}
