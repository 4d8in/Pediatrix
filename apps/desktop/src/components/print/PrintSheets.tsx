import type { ReactNode } from "react";
import { DISCHARGE_OUTCOMES } from "../../lib/types";
import type { Diagnosis, Facility, Immunization, ImagingReport, Invoice, Patient, PatientStay, Prescription, Referral, Report } from "../../lib/types";
import { formatMoney } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

// Modèles des documents imprimés. Mise en page sobre (noir sur blanc), une page A4.

function Letterhead({ facility, title }: { facility: Facility; title: string }) {
  return (
    <header style={{ borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: "16pt", fontWeight: 700 }}>{facility.name}</div>
          <div style={{ fontSize: "10pt" }}>
            {[facility.address, facility.phone].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ fontSize: "14pt", fontWeight: 600, textTransform: "uppercase" }}>{title}</div>
      </div>
    </header>
  );
}

function PatientBlock({ patient }: { patient: Patient }) {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: 16, fontSize: "11pt" }}>
      <strong>
        {patient.firstName} {patient.lastName}
      </strong>
      {" — "}{t("né(e) le {date} — dossier {mrn}", { date: patient.birthDate, mrn: patient.mrn })}
      {patient.guardian && (
        <div>
          {t("Tuteur :")} {patient.guardian.name} ({patient.guardian.relationship}), {patient.guardian.phone}
        </div>
      )}
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div style={{ marginTop: 48, textAlign: "right", fontSize: "11pt" }}>
      <div>{label}</div>
      <div style={{ height: 48 }} />
      <div style={{ borderTop: "1px solid #111", display: "inline-block", minWidth: 180 }}>&nbsp;</div>
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: "sans-serif", lineHeight: 1.4 }}>{children}</div>;
}

export function PrescriptionSheet({ facility, patient, prescriptions }: { facility: Facility; patient: Patient; prescriptions: Prescription[] }) {
  const { t, formatDateTime } = useI18n();
  return (
    <Page>
      <Letterhead facility={facility} title={t("Ordonnance")} />
      <PatientBlock patient={patient} />
      <ol style={{ paddingLeft: 20 }}>
        {prescriptions.map((rx) => (
          <li key={rx.id} style={{ marginBottom: 12 }}>
            <strong>{rx.medication ?? t("Médicament")}</strong>
            <div>{rx.dosage}</div>
            <div style={{ fontSize: "10pt", color: "#444" }}>{t("Prescrit le {date}", { date: formatDateTime(rx.date) })}</div>
          </li>
        ))}
      </ol>
      <Signature label={t("Le médecin")} />
    </Page>
  );
}

export function LabReportSheet({ facility, patient, report }: { facility: Facility; patient: Patient; report: Report }) {
  const { t, formatDateTime } = useI18n();
  return (
    <Page>
      <Letterhead facility={facility} title={t("Compte rendu d'examen")} />
      <PatientBlock patient={patient} />
      <h2 style={{ fontSize: "13pt", margin: "8px 0" }}>{report.exam ?? t("Examen")}</h2>
      <div style={{ fontSize: "10pt", marginBottom: 8 }}>{t("Rendu le {date}", { date: formatDateTime(report.date) })}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111", textAlign: "left" }}>
            <th>{t("Paramètre")}</th>
            <th>{t("Résultat")}</th>
            <th>{t("Valeurs de référence")}</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((result) => (
            <tr key={result.label} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{result.label}</td>
              <td style={{ fontWeight: result.flag && result.flag !== "N" ? 700 : 400 }}>
                {result.value}
                {result.flag === "H" && " ↑"}
                {result.flag === "L" && " ↓"}
                {result.flag === "HH" && ` ↑↑ (${t("critique")})`}
                {result.flag === "LL" && ` ↓↓ (${t("critique")})`}
              </td>
              <td>{result.reference ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.conclusion && (
        <p style={{ marginTop: 12 }}>
          <strong>{t("Conclusion :")}</strong> {report.conclusion}
        </p>
      )}
      <Signature label={t("Le biologiste")} />
    </Page>
  );
}

export function VaccinationCardSheet({ facility, patient, immunizations }: { facility: Facility; patient: Patient; immunizations: Immunization[] }) {
  const { t, formatDate } = useI18n();
  return (
    <Page>
      <Letterhead facility={facility} title={t("Carnet de vaccination")} />
      <PatientBlock patient={patient} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111", textAlign: "left" }}>
            <th>{t("Vaccin")}</th>
            <th>{t("Dose")}</th>
            <th>{t("Date")}</th>
          </tr>
        </thead>
        <tbody>
          {immunizations.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{item.vaccine ?? ""}</td>
              <td>{item.doseNumber ?? ""}</td>
              <td>{formatDate(item.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Signature label={t("Cachet et signature")} />
    </Page>
  );
}

export function InvoiceSheet({ facility, invoice }: { facility: Facility; invoice: Invoice }) {
  const { t, formatDate } = useI18n();
  return (
    <Page>
      <Letterhead facility={facility} title={invoice.status === "balanced" ? t("Reçu") : t("Facture")} />
      <div style={{ marginBottom: 16, fontSize: "11pt" }}>
        <strong>{invoice.patientName}</strong> — {t("facture n° {id} du {date}", { id: invoice.id, date: formatDate(invoice.date) })}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={index} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{line.description}</td>
              <td style={{ textAlign: "right" }}>{formatMoney(line.amount, invoice.currency)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>{t("Total")}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(invoice.total, invoice.currency)}</td>
          </tr>
          {invoice.coveragePercent > 0 && (
            <tr>
              <td>
                {t("Pris en charge par {assureur} ({pct} %)", { assureur: invoice.insurer ?? "", pct: invoice.coveragePercent })}
              </td>
              <td style={{ textAlign: "right" }}>− {formatMoney(invoice.insurerShare, invoice.currency)}</td>
            </tr>
          )}
          <tr>
            <td>{t("Payé")}</td>
            <td style={{ textAlign: "right" }}>{formatMoney(invoice.paid, invoice.currency)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>{t("Reste à payer")}</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(invoice.balance, invoice.currency)}</td>
          </tr>
        </tbody>
      </table>
      <Signature label={t("Le caissier")} />
    </Page>
  );
}

export function ReferralSheet({
  facility,
  patient,
  referral,
  diagnoses,
}: {
  facility: Facility;
  patient: Patient;
  referral: Referral;
  diagnoses: Diagnosis[];
}) {
  const { t, formatDateTime } = useI18n();
  return (
    <Page>
      <Letterhead facility={facility} title={t("Fiche de référence")} />
      <div style={{ marginBottom: 12, fontSize: "11pt" }}>
        {t("À l'attention de :")} <strong>{referral.destination}</strong>
        {referral.urgent && <strong style={{ marginLeft: 12, textTransform: "uppercase" }}>— {t("Urgent")}</strong>}
        <div>{t("Le {date}", { date: formatDateTime(referral.date) })}</div>
      </div>
      <PatientBlock patient={patient} />
      <p>
        <strong>{t("Motif de la référence :")}</strong> {referral.reason}
      </p>
      {diagnoses.length > 0 && (
        <p>
          <strong>{t("Diagnostic(s) :")}</strong>{" "}
          {diagnoses.map((d) => `${d.text}${d.code ? ` (${t("CIM-10")} ${d.code})` : ""}${d.certainty === "provisional" ? ` — ${t("provisoire")}` : ""}`).join(" ; ")}
        </p>
      )}
      {referral.summary && (
        <p style={{ whiteSpace: "pre-wrap" }}>
          <strong>{t("Résumé clinique :")}</strong> {referral.summary}
        </p>
      )}
      <Signature label={referral.sender ? `Dr ${referral.sender.replace(/^Dr\.?\s+/i, "")}` : t("Le médecin")} />
    </Page>
  );
}

// Résumé de sortie d'hospitalisation : séjour, diagnostics, traitements, examens et consignes de sortie.
export function DischargeSummarySheet({
  facility,
  patient,
  stay,
  diagnoses,
  prescriptions,
  reports,
  imagingReports,
}: {
  facility: Facility;
  patient: Patient;
  stay: PatientStay;
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  reports: Report[];
  imagingReports: ImagingReport[];
}) {
  const { t, formatDate, formatDateTime } = useI18n();
  const outcome = DISCHARGE_OUTCOMES.find((item) => item.value === stay.outcome);
  return (
    <Page>
      <Letterhead facility={facility} title={t("Résumé de sortie")} />
      <PatientBlock patient={patient} />
      <p>
        <strong>{t("Hospitalisation :")}</strong> {t("Du {debut}", { debut: formatDate(stay.start) })}{" "}
        {stay.end ? t("au {fin}", { fin: formatDate(stay.end) }) : ""}
        {stay.beds.length > 0 && ` — ${t("Lits : {lits}", { lits: stay.beds.map((bed) => bed.name).join(" → ") })}`}
      </p>
      {stay.reason && (
        <p>
          <strong>{t("Motif d'admission :")}</strong> {stay.reason}
        </p>
      )}
      {diagnoses.length > 0 && (
        <p>
          <strong>{t("Diagnostic(s) :")}</strong>{" "}
          {diagnoses.map((d) => `${d.text}${d.code ? ` (${t("CIM-10")} ${d.code})` : ""}${d.certainty === "provisional" ? ` — ${t("provisoire")}` : ""}`).join(" ; ")}
        </p>
      )}
      {prescriptions.length > 0 && (
        <>
          <p style={{ marginBottom: 2 }}>
            <strong>{t("Traitements prescrits :")}</strong>
          </p>
          <ul style={{ marginTop: 0 }}>
            {prescriptions.map((p) => (
              <li key={p.id}>
                {p.medication} — {p.dosage}
              </li>
            ))}
          </ul>
        </>
      )}
      {(reports.length > 0 || imagingReports.length > 0) && (
        <>
          <p style={{ marginBottom: 2 }}>
            <strong>{t("Examens réalisés :")}</strong>
          </p>
          <ul style={{ marginTop: 0 }}>
            {reports.map((r) => (
              <li key={r.id}>
                {r.exam} ({formatDate(r.date)})
                {r.results.length > 0 && ` : ${r.results.map((x) => `${x.label} ${x.value}${x.flag === "HH" || x.flag === "LL" ? ` [${t("critique")}]` : ""}`).join(" ; ")}`}
                {r.conclusion && ` — ${r.conclusion}`}
              </li>
            ))}
            {imagingReports.map((r) => (
              <li key={r.id}>
                {r.exam} ({formatDate(r.date)}){r.conclusion && ` — ${r.conclusion}`}
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        <strong>{t("Issue du séjour :")}</strong> {outcome ? t(outcome.label) : t("Non renseignée")}
      </p>
      {stay.summary && (
        <p>
          <strong>{t("Résumé et consignes de sortie :")}</strong> {stay.summary}
        </p>
      )}
      <p style={{ fontSize: "9pt" }}>{t("Établi le {date}", { date: formatDateTime(new Date().toISOString()) })}</p>
      <Signature label={t("Le médecin")} />
    </Page>
  );
}
