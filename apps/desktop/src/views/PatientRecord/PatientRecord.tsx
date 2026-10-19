import { useCallback, useEffect, useRef, useState } from "react";
import PatientPicker from "../../components/PatientPicker";
import { useI18n } from "../../lib/i18n";
import PatientIdentity from "./PatientIdentity";
import ConsultationHistory from "./ConsultationHistory";
import ReportsHistory from "./ReportsHistory";
import ImagingReportsHistory from "./ImagingReportsHistory";
import ImmunizationSection from "./ImmunizationSection";
import GrowthSection from "./GrowthSection";
import AllergiesSection from "./AllergiesSection";
import PrescriptionsHistory from "./PrescriptionsHistory";
import StaysSection from "./StaysSection";
import DiagnosesSection from "./DiagnosesSection";
import ReferralsSection from "./ReferralsSection";
import {
  ApiError,
  getPatient,
  getPatientAllergies,
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
                {ageLabel(record.patient.birthDate, t)} • {t(SEX_LABELS[record.patient.gender])} • {t("N° de dossier : {mrn}", { mrn: record.patient.mrn })}
              </p>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-5">
            {TABS.map((tab) => (
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
            {activeTab === "stays" && <StaysSection stays={stays} />}
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

type RecordTab = "info" | "consultations" | "stays" | "exams" | "vaccinations" | "growth" | "allergies";

const TABS: { id: RecordTab; label: string }[] = [
  { id: "info", label: "Informations" },
  { id: "consultations", label: "Consultations et prescriptions" },
  { id: "stays", label: "Hospitalisations" },
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
