import { useCallback, useEffect, useRef, useState } from "react";
import PatientPicker from "../../components/PatientPicker";
import { DischargeSummarySheet } from "../../components/print/PrintSheets";
import { usePrint } from "../../lib/print";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth-context";
import PatientIdentity from "./PatientIdentity";
import ConsultationHistory from "./ConsultationHistory";
import ReportsHistory from "./ReportsHistory";
import ImagingReportsHistory from "./ImagingReportsHistory";
import ImmunizationSection from "./ImmunizationSection";
import GrowthSection from "./GrowthSection";
import AllergiesSection from "./AllergiesSection";
import PrescriptionsHistory from "./PrescriptionsHistory";
import StaysSection from "./StaysSection";
import BirthSection from "./BirthSection";
import PmtctSection from "./PmtctSection";
import DiagnosesSection from "./DiagnosesSection";
import ReferralsSection from "./ReferralsSection";
import {
  ApiError,
  getPatient,
  getPatientAllergies,
  getPatientBirth,
  getPatientPmtct,
  revokeDeath,
  getPatientDiagnoses,
  getPatientReferrals,
  getPatientGrowth,
  getPatientImagingReports,
  getPatientImmunizations,
  getPatientPrescriptions,
  getPatientStays,
  getPatientReports,
} from "../../lib/api";
import type {
  Diagnosis,
  Referral,
  PatientStay,
  Allergy,
  BirthRecord,
  PmtctFollowUp,
  GrowthMeasurement,
  ImagingReport,
  Immunization,
  Patient,
  PatientRecord as PatientRecordData,
  Prescription,
  Report,
} from "../../lib/types";

interface PatientRecordProps {
  initialPatientId?: string | null;
}

export default function PatientRecord({ initialPatientId }: PatientRecordProps) {
  const { t } = useI18n();
  const { printDocument } = usePrint();
  const { user } = useAuth();
  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<PatientRecordData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [imagingReports, setImagingReports] = useState<ImagingReport[]>([]);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [stays, setStays] = useState<PatientStay[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [birth, setBirth] = useState<BirthRecord | null>(null);
  const [ptme, setPtme] = useState<PmtctFollowUp | null>(null);
  const [activeTab, setActiveTab] = useState<RecordTab>("info");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Id du patient présélectionné venant du Dashboard, consommé une seule fois
  // au montage : le dossier se charge directement, sans passer par
  // PatientPicker. Remis à null si l'utilisateur déselectionne ensuite le
  // patient (bouton "X"), pour ne pas le voir "ressusciter" via ce deep-link.
  const initialPatientIdRef = useRef(initialPatientId ?? null);
  const patientId = patient?.id ?? initialPatientIdRef.current;

  function selectPatient(next: Patient | null) {
    setPatient(next);
    if (!next) initialPatientIdRef.current = null;
  }

  const loadRecord = useCallback(() => {
    if (!patientId) {
      setRecord(null);
      setReports([]);
      setImagingReports([]);
      setImmunizations([]);
      setGrowthMeasurements([]);
      setAllergies([]);
      setPrescriptions([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    Promise.all([
      getPatient(patientId),
      // Chaque rôle ne lit que sa part du dossier : un refus (403) donne une section vide,
      // le dossier se charge quand même (seule l'identité est indispensable).
      getPatientReports(patientId).catch(() => ({ reports: [] as Report[] })),
      getPatientImagingReports(patientId).catch(() => ({ reports: [] as ImagingReport[] })),
      getPatientImmunizations(patientId).catch(() => ({ immunizations: [] as Immunization[] })),
      getPatientGrowth(patientId).catch(() => ({ measurements: [] as GrowthMeasurement[] })),
      getPatientAllergies(patientId).catch(() => ({ allergies: [] as Allergy[] })),
      getPatientPrescriptions(patientId).catch(() => ({ prescriptions: [] as Prescription[] })),
      getPatientStays(patientId).catch(() => ({ stays: [] as PatientStay[] })),
      getPatientDiagnoses(patientId).catch(() => ({ diagnoses: [] as Diagnosis[] })),
      getPatientReferrals(patientId).catch(() => ({ referrals: [] as Referral[] })),
      getPatientBirth(patientId).catch(() => ({ birth: null as BirthRecord | null })),
      getPatientPmtct(patientId).catch(() => ({ ptme: null as PmtctFollowUp | null })),
    ])
      .then(
        ([
          recordData,
          reportsData,
          imagingReportsData,
          immunizationsData,
          growthData,
          allergiesData,
          prescriptionsData,
          staysData,
          diagnosesData,
          referralsData,
          birthData,
          ptmeData,
        ]) => {
          setRecord(recordData);
          setPatient(recordData.patient);
          setReports(reportsData.reports);
          setImagingReports(imagingReportsData.reports);
          setImmunizations(immunizationsData.immunizations);
          setGrowthMeasurements(growthData.measurements);
          setAllergies(allergiesData.allergies);
          setPrescriptions(prescriptionsData.prescriptions);
          setStays(staysData.stays);
          setDiagnoses(diagnosesData.diagnoses);
          setReferrals(referralsData.referrals);
          setBirth(birthData.birth);
          setPtme(ptmeData.ptme);
        },
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Erreur de chargement du dossier.")))
      .finally(() => setIsLoading(false));
  }, [patientId, t]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-zinc-900">{t("Dossier patient")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("Identité, consultations, examens et suivi de l'enfant")}</p>
      </div>

      <section className="rounded-[18px] border border-zinc-200/70 bg-white p-5">
        <PatientPicker selected={patient} onSelect={selectPatient} />
      </section>

      {isLoading && <p className="text-sm text-zinc-400">{t("Chargement du dossier…")}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {record && (
        <section className="rounded-[18px] border border-zinc-200/70 bg-white">
          <div className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1A6FD4]/10 text-lg font-medium text-[#1A6FD4]">
              {`${record.patient.firstName[0] ?? ""}${record.patient.lastName[0] ?? ""}`.toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-medium text-zinc-900">
                {record.patient.firstName} {record.patient.lastName}
              </p>
              <p className="text-sm text-zinc-500">
                {record.patient.deceasedAt && (
                  <span className="mr-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-white" data-testid="deceased-badge">
                    {t("Décédé")}
                  </span>
                )}
                {ageLabel(record.patient.birthDate, t)} • {t(SEX_LABELS[record.patient.gender])} • {t("N° de dossier : {mrn}", { mrn: record.patient.mrn })}
              </p>
              {record.patient.deceasedAt && user?.role === "doctor" && (
                <div className="mt-1 text-xs">
                  {!revoking ? (
                    <button onClick={() => setRevoking(true)} className="text-zinc-500 underline" data-testid="revoke-death-open">
                      {t("Corriger : le patient n'est pas décédé")}
                    </button>
                  ) : (
                    <span className="flex gap-2">
                      <input
                        aria-label={t("Motif de la correction")}
                        value={revokeReason}
                        maxLength={500}
                        onChange={(event) => setRevokeReason(event.target.value)}
                        placeholder={t("Motif de la correction (requis)")}
                        className="w-64 rounded border border-zinc-200 px-2 py-1"
                      />
                      <button
                        disabled={revokeReason.trim().length < 5}
                        onClick={() =>
                          revokeDeath(record.patient.id, revokeReason.trim())
                            .then(() => {
                              setRevoking(false);
                              setRevokeReason("");
                              loadRecord();
                            })
                            .catch((err) => setError(err instanceof ApiError ? err.message : t("Erreur lors de la correction.")))
                        }
                        className="rounded bg-zinc-800 px-2 py-1 text-white disabled:opacity-40"
                      >
                        {t("Annuler le décès")}
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-5">
            {TABS.filter((tab) => tab.id !== "ptme" || user?.role === "nurse" || user?.role === "doctor").map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                  activeTab === tab.id
                    ? "border-[#1A6FD4] font-medium text-[#1A6FD4]"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>

          <div className="space-y-5 p-5">
            {activeTab === "info" && <PatientIdentity patient={record.patient} />}
            {activeTab === "consultations" && (
              <>
                <DiagnosesSection diagnoses={diagnoses} />
                <ReferralsSection referrals={referrals} diagnoses={diagnoses} patient={record.patient} />
                <ConsultationHistory consultations={record.consultations} />
                <PrescriptionsHistory prescriptions={prescriptions} patient={record.patient} />
              </>
            )}
            {activeTab === "stays" && (
              <StaysSection
                stays={stays}
                prescriptions={prescriptions}
                onPrintSummary={(stay) => {
                  // Éléments du dossier rattachés au séjour : ceux datés du jour d'admission au jour de
                  // sortie inclus (pas de marge au-delà). Sans date de début ou de fin fiable, aucun
                  // élément n'est joint plutôt que d'imprimer tout l'historique de l'enfant.
                  const startDay = stay.start ? new Date(stay.start) : null;
                  const endDay = stay.end ? new Date(stay.end) : null;
                  if (startDay) startDay.setHours(0, 0, 0, 0);
                  if (endDay) endDay.setHours(23, 59, 59, 999);
                  const from = startDay ? startDay.getTime() : Number.NaN;
                  const to = endDay ? endDay.getTime() : Number.NaN;
                  const within = (date: string | null) => {
                    const time = date ? Date.parse(date) : Number.NaN;
                    return !Number.isNaN(time) && !Number.isNaN(from) && !Number.isNaN(to) && time >= from && time <= to;
                  };
                  printDocument((facility) => (
                    <DischargeSummarySheet
                      facility={facility}
                      patient={record.patient}
                      stay={stay}
                      diagnoses={diagnoses.filter((d) => within(d.date))}
                      prescriptions={prescriptions.filter((p) => within(p.date))}
                      reports={reports.filter((r) => within(r.date))}
                      imagingReports={imagingReports.filter((r) => within(r.date))}
                    />
                  ));
                }}
              />
            )}
            {activeTab === "birth" && <BirthSection patientId={record.patient.id} birth={birth} onCreated={loadRecord} />}
            {activeTab === "ptme" && <PmtctSection patientId={record.patient.id} ptme={ptme} onChanged={loadRecord} />}
            {activeTab === "exams" && (
              <>
                <ReportsHistory reports={reports} patient={record.patient} />
                <ImagingReportsHistory reports={imagingReports} />
              </>
            )}
            {activeTab === "vaccinations" && (
              <ImmunizationSection patientId={record.patient.id} patient={record.patient} immunizations={immunizations} onCreated={loadRecord} />
            )}
            {activeTab === "growth" && (
              <GrowthSection patientId={record.patient.id} measurements={growthMeasurements} onCreated={loadRecord} />
            )}
            {activeTab === "allergies" && (
              <AllergiesSection patientId={record.patient.id} allergies={allergies} onCreated={loadRecord} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

type RecordTab = "info" | "consultations" | "stays" | "birth" | "ptme" | "exams" | "vaccinations" | "growth" | "allergies";

const TABS: { id: RecordTab; label: string }[] = [
  { id: "info", label: "Informations" },
  { id: "consultations", label: "Consultations et prescriptions" },
  { id: "stays", label: "Hospitalisations" },
  { id: "birth", label: "Naissance" },
  { id: "ptme", label: "PTME" },
  { id: "exams", label: "Examens" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "growth", label: "Croissance" },
  { id: "allergies", label: "Allergies" },
];

const SEX_LABELS: Record<Patient["gender"], string> = {
  male: "Garçon",
  female: "Fille",
  other: "Autre",
  unknown: "Sexe non renseigné",
};

function ageLabel(birthDate: string, t: (fr: string, vars?: Record<string, string | number>) => string): string {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return t("Âge inconnu");
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  return months < 12 ? t("{n} mois", { n: Math.max(months, 0) }) : t("{n} ans", { n: Math.floor(months / 12) });
}
