import { useEffect, useState } from "react";
import PatientPicker from "../../components/PatientPicker";
import PatientIdentity from "./PatientIdentity";
import ConsultationHistory from "./ConsultationHistory";
import ReportsHistory from "./ReportsHistory";
import ImagingReportsHistory from "./ImagingReportsHistory";
import { ApiError, getPatient, getPatientImagingReports, getPatientReports } from "../../lib/api";
import type { ImagingReport, Patient, PatientRecord as PatientRecordData, Report } from "../../lib/types";

export default function PatientRecord() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<PatientRecordData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [imagingReports, setImagingReports] = useState<ImagingReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) {
      setRecord(null);
      setReports([]);
      setImagingReports([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    Promise.all([getPatient(patient.id), getPatientReports(patient.id), getPatientImagingReports(patient.id)])
      .then(([recordData, reportsData, imagingReportsData]) => {
        setRecord(recordData);
        setReports(reportsData.reports);
        setImagingReports(imagingReportsData.reports);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erreur de chargement du dossier."))
      .finally(() => setIsLoading(false));
  }, [patient]);

  return (
    <div className="p-10 max-w-4xl mx-auto space-y-10">
      <div className="border-b border-zinc-200 pb-10">
        <h1 className="text-3xl font-black text-zinc-900 uppercase tracking-[0.2em] mb-3">Dossier patient</h1>
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
          Identité et historique des consultations
        </p>
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
        </div>
      )}
    </div>
  );
}
