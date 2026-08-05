import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "../../lib/utils";
import PatientPicker from "../../components/PatientPicker";
import PatientIdentity from "./PatientIdentity";
import ConsultationHistory from "./ConsultationHistory";
import ReportsHistory from "./ReportsHistory";
import ImagingReportsHistory from "./ImagingReportsHistory";
import ImmunizationSection from "./ImmunizationSection";
import GrowthSection from "./GrowthSection";
import AllergiesSection from "./AllergiesSection";
import PrescriptionsHistory from "./PrescriptionsHistory";
import {
  ApiError,
  getPatient,
  getPatientAllergies,
  getPatientGrowth,
  getPatientImagingReports,
  getPatientImmunizations,
  getPatientPrescriptions,
  getPatientReports,
} from "../../lib/api";
import type {
  Allergy,
  GrowthMeasurement,
  ImagingReport,
  Immunization,
  Patient,
  PatientRecord as PatientRecordData,
  Prescription,
  Report,
} from "../../lib/types";

interface EmergencyAlert {
  isActive: boolean;
  patientId: string | null;
  patientName: string | null;
  isResolved: boolean;
  resolvedTime: string | null;
}

interface PatientRecordProps {
  emergencyAlert?: EmergencyAlert;
  onTriggerEmergency?: (patientId: string, patientName: string) => void;
  initialPatientId?: string | null;
}

export default function PatientRecord({ emergencyAlert, onTriggerEmergency, initialPatientId }: PatientRecordProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<PatientRecordData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [imagingReports, setImagingReports] = useState<ImagingReport[]>([]);
  const [immunizations, setImmunizations] = useState<Immunization[]>([]);
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecord = useCallback(() => {
    if (!patient) {
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
      getPatient(patient.id),
      getPatientReports(patient.id),
      getPatientImagingReports(patient.id),
      getPatientImmunizations(patient.id),
      getPatientGrowth(patient.id),
      getPatientAllergies(patient.id),
      getPatientPrescriptions(patient.id),
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
        ]) => {
          setRecord(recordData);
          setReports(reportsData.reports);
          setImagingReports(imagingReportsData.reports);
          setImmunizations(immunizationsData.immunizations);
          setGrowthMeasurements(growthData.measurements);
          setAllergies(allergiesData.allergies);
          setPrescriptions(prescriptionsData.prescriptions);
        },
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de chargement du dossier."))
      .finally(() => setIsLoading(false));
  }, [patient]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Reçoit un patient présélectionné (venant du Dashboard) : le dossier se
  // charge directement, sans passer par PatientPicker. Celui-ci reste
  // disponible ensuite pour chercher un autre patient.
  useEffect(() => {
    if (!initialPatientId) return;
    let cancelled = false;
    getPatient(initialPatientId)
      .then((data) => {
        if (!cancelled) setPatient(data.patient);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Erreur de chargement du patient.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId]);

  const isEmergencyForPatient =
    !!record && emergencyAlert?.isActive && emergencyAlert.patientId === record.patient.id;

  return (
    <div className="p-10 max-w-4xl mx-auto space-y-10">
      <div className="border-b border-zinc-200 pb-10 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Dossier patient</h1>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
            Identité et historique des consultations
          </p>
        </div>
        {record && (
          <button
            onClick={() =>
              onTriggerEmergency?.(record.patient.id, `${record.patient.firstName} ${record.patient.lastName}`)
            }
            className={cn(
              "px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 shrink-0",
              isEmergencyForPatient
                ? "bg-white border-2 border-red-600 text-red-600 animate-pulse"
                : "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            <Activity className="w-4 h-4" />
            {isEmergencyForPatient ? "Urgence active" : "Signaler une urgence"}
          </button>
        )}
      </div>

      <section className="bg-white border border-zinc-200 shadow-sm overflow-hidden p-10">
        <PatientPicker selected={patient} onSelect={setPatient} />
      </section>

      {isLoading && (
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Chargement du dossier...</p>
      )}
      {error && <p className="text-[10px] font-mono text-red-600 uppercase tracking-widest">{error}</p>}

      {record && (
        <div className="space-y-10 pb-20">
          <PatientIdentity patient={record.patient} />
          <ConsultationHistory consultations={record.consultations} />
          <ReportsHistory reports={reports} />
          <ImagingReportsHistory reports={imagingReports} />
          <ImmunizationSection
            patientId={record.patient.id}
            immunizations={immunizations}
            onCreated={loadRecord}
          />
          <GrowthSection
            patientId={record.patient.id}
            measurements={growthMeasurements}
            onCreated={loadRecord}
          />
          <AllergiesSection patientId={record.patient.id} allergies={allergies} onCreated={loadRecord} />
          <PrescriptionsHistory prescriptions={prescriptions} />
        </div>
      )}
    </div>
  );
}
