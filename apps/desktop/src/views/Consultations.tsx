import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Pill, ScanLine } from "lucide-react";
import PatientPicker from "../components/PatientPicker";
import VitalsFields from "./VitalsFields";
import {
  ApiError,
  createDiagnosis,
  createEncounter,
  createImagingRequest,
  createPrescription,
  createReferral,
  createServiceRequest,
  getDiagnosisCatalog,
  getFormulary,
  getLabCatalog,
  getPatient,
} from "../lib/api";
import type { AllergyConflict, Certainty, DiagnosisCatalogItem, FormularyItem, LabTest, Patient, Vitals } from "../lib/types";

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

  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [formulary, setFormulary] = useState<FormularyItem[]>([]);
  const [diagnosisCatalog, setDiagnosisCatalog] = useState<DiagnosisCatalogItem[]>([]);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [certainty, setCertainty] = useState<Certainty>("confirmed");
  const [diagnosisErrors, setDiagnosisErrors] = useState<string[]>([]);
  const [recordedDiagnoses, setRecordedDiagnoses] = useState<string[]>([]);

  const [referralDestination, setReferralDestination] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [referralSummary, setReferralSummary] = useState("");
  const [referralUrgent, setReferralUrgent] = useState(false);
  const [referralErrors, setReferralErrors] = useState<string[]>([]);
  const [referralDone, setReferralDone] = useState<string | null>(null);

  const [exam, setExam] = useState("");
  const [examUrgent, setExamUrgent] = useState(false);
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
  const [doseMg, setDoseMg] = useState("");
  const [dosesPerDay, setDosesPerDay] = useState("");
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
    setExamUrgent(false);
    setRequester("");
    setExamErrors([]);
    setExamRequested(false);
    setImagingExam("");
    setImagingRequester("");
    setImagingErrors([]);
    setImagingRequested(false);
    setMedication("");
    setDosage("");
    setDoseMg("");
    setDosesPerDay("");
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

  // Le catalogue sert de suggestion : s'il est indisponible, la saisie libre continue de marcher.
  useEffect(() => {
    getLabCatalog()
      .then((data) => setLabTests(data.tests))
      .catch(() => setLabTests([]));
    getFormulary()
      .then((data) => setFormulary(data.items))
      .catch(() => setFormulary([]));
    getDiagnosisCatalog()
      .then((data) => setDiagnosisCatalog(data.diagnoses))
      .catch(() => setDiagnosisCatalog([]));
  }, []);

  async function handleAddDiagnosis(event: FormEvent) {
    event.preventDefault();
    if (!encounterId) return;
    setDiagnosisErrors([]);
    // Un libellé du catalogue envoie son code CIM-10 ; sinon le diagnostic reste libre.
    const entry = diagnosisCatalog.find((item) => item.display === diagnosisText.trim());
    try {
      await createDiagnosis(encounterId, entry ? { code: entry.code, certainty } : { text: diagnosisText, certainty });
      setRecordedDiagnoses((list) => [...list, entry ? `${entry.display} (${entry.code})` : diagnosisText.trim()]);
      setDiagnosisText("");
    } catch (error) {
      setDiagnosisErrors(error instanceof ApiError ? (error.details ?? [error.message]) : ["Erreur inattendue."]);
    }
  }

  async function handleReferral(event: FormEvent) {
    event.preventDefault();
    if (!encounterId) return;
    setReferralErrors([]);
    try {
      await createReferral(encounterId, {
        destination: referralDestination,
        reason: referralReason,
        summary: referralSummary || undefined,
        urgent: referralUrgent,
      });
      setReferralDone(referralDestination);
    } catch (error) {
      setReferralErrors(error instanceof ApiError ? (error.details ?? [error.message]) : ["Erreur inattendue."]);
    }
  }

  async function handleRequestExam(event: FormEvent) {
    event.preventDefault();
    if (!encounterId) return;

    setExamErrors([]);
    setIsRequestingExam(true);

    try {
      const examCode = labTests.find((test) => test.display === exam.trim())?.code;
      await createServiceRequest(encounterId, { exam, requester, examCode, urgent: examUrgent });
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
      const formularyCode = formulary.find((item) => item.name === medication)?.code;
      const structured =
        doseMg.trim() && dosesPerDay.trim()
          ? { formularyCode, doseMg: Number(doseMg.replace(",", ".")), dosesPerDay: Number(dosesPerDay) }
          : {};
      await createPrescription(encounterId, { medication, dosage, confirmed, ...structured });
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
            <form onSubmit={handleAddDiagnosis} className="space-y-4" data-testid="diagnosis-form">
              <h3 className="text-sm font-medium text-zinc-400">Diagnostic</h3>
              {diagnosisErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
                  {diagnosisErrors.map((message) => (
                    <p key={message} className="text-xs font-medium text-red-700">
                      {message}
                    </p>
                  ))}
                </div>
              )}
              {recordedDiagnoses.length > 0 && (
                <ul className="space-y-1 text-xs text-zinc-700">
                  {recordedDiagnoses.map((label, index) => (
                    <li key={index}>• {label}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  list="diagnosis-catalog"
                  data-testid="diagnosis-input"
                  value={diagnosisText}
                  onChange={(event) => setDiagnosisText(event.target.value)}
                  className="flex-1 px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                  placeholder="Ex. : Paludisme à Plasmodium falciparum"
                />
                <datalist id="diagnosis-catalog">
                  {diagnosisCatalog.map((item) => (
                    <option key={item.code} value={item.display} />
                  ))}
                </datalist>
                <select
                  value={certainty}
                  onChange={(event) => setCertainty(event.target.value as Certainty)}
                  className="px-3 py-3 bg-zinc-50 border border-zinc-200 text-xs rounded-xl"
                >
                  <option value="confirmed">Confirmé</option>
                  <option value="provisional">Provisoire</option>
                </select>
                <button
                  type="submit"
                  data-testid="diagnosis-submit"
                  className="px-6 py-3 bg-[#1A6FD4] text-white text-xs font-medium hover:bg-[#1559ab] transition-all rounded-full"
                >
                  Ajouter
                </button>
              </div>
            </form>

            {referralDone ? (
              <div className="bg-zinc-50 border border-zinc-200/70 p-6 rounded-[18px]">
                <p className="text-xs font-medium text-zinc-700" data-testid="referral-done">
                  Référence enregistrée vers {referralDone}. La fiche est imprimable depuis le dossier du patient
                  (Consultations et prescriptions).
                </p>
              </div>
            ) : (
              <form onSubmit={handleReferral} className="space-y-4" data-testid="referral-form">
                <h3 className="text-sm font-medium text-zinc-400">Référer vers une autre structure (optionnel)</h3>
                {referralErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 space-y-2 rounded-[18px]">
                    {referralErrors.map((message) => (
                      <p key={message} className="text-xs font-medium text-red-700">
                        {message}
                      </p>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  data-testid="referral-destination"
                  value={referralDestination}
                  onChange={(event) => setReferralDestination(event.target.value)}
                  placeholder="Structure de destination (ex. Hôpital régional, CHU…)"
                  className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                />
                <input
                  type="text"
                  data-testid="referral-reason"
                  value={referralReason}
                  onChange={(event) => setReferralReason(event.target.value)}
                  placeholder="Motif de la référence"
                  className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                />
                <textarea
                  value={referralSummary}
                  onChange={(event) => setReferralSummary(event.target.value)}
                  rows={3}
                  placeholder="Résumé clinique et traitements déjà donnés"
                  className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs resize-none rounded-xl"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input type="checkbox" checked={referralUrgent} onChange={(event) => setReferralUrgent(event.target.checked)} />
                    Référence urgente
                  </label>
                  <button
                    type="submit"
                    data-testid="referral-submit"
                    disabled={!referralDestination.trim() || !referralReason.trim()}
                    className="px-6 py-3 bg-[#1A6FD4] text-white text-xs font-medium hover:bg-[#1559ab] transition-all rounded-full disabled:opacity-40"
                  >
                    Enregistrer la référence
                  </button>
                </div>
              </form>
            )}

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
                    list="lab-exam-catalog"
                    value={exam}
                    onChange={(event) => setExam(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Numération formule sanguine (NFS)"
                  />
                  <datalist id="lab-exam-catalog">
                    {labTests.map((test) => (
                      <option key={test.code} value={test.display} />
                    ))}
                  </datalist>
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

                <label className="flex items-center gap-2 text-sm text-zinc-500">
                  <input
                    type="checkbox"
                    data-testid="exam-request-urgent"
                    checked={examUrgent}
                    onChange={(event) => setExamUrgent(event.target.checked)}
                  />
                  Demande urgente (passe en tête de la file du laboratoire)
                </label>

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
                    list="formulary-items"
                    value={medication}
                    onChange={(event) => setMedication(event.target.value)}
                    className="w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                    placeholder="Ex. : Amoxicilline"
                  />
                  <datalist id="formulary-items">
                    {formulary.map((item) => (
                      <option key={item.code} value={item.name} />
                    ))}
                  </datalist>
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

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-zinc-400">
                    Dose par prise (mg, facultatif)
                    <input
                      type="text"
                      inputMode="decimal"
                      data-testid="prescription-dose-mg"
                      value={doseMg}
                      onChange={(event) => setDoseMg(event.target.value)}
                      className="mt-2 w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                      placeholder="Ex. : 150"
                    />
                  </label>
                  <label className="text-sm font-medium text-zinc-400">
                    Prises par jour
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid="prescription-doses-per-day"
                      value={dosesPerDay}
                      onChange={(event) => setDosesPerDay(event.target.value)}
                      className="mt-2 w-full px-5 py-3 bg-zinc-50 border border-zinc-200 focus:bg-white focus:border-[#1A6FD4] outline-none transition-all text-xs rounded-xl"
                      placeholder="Ex. : 3"
                    />
                  </label>
                </div>
                <p className="text-xs text-zinc-400">
                  Avec une dose et un médicament du formulaire, la dose quotidienne par kg est contrôlée d'après le dernier poids enregistré.
                </p>

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
