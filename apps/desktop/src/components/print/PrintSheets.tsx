import type { ReactNode } from "react";
import type { Diagnosis, Facility, Immunization, Invoice, Patient, Prescription, Referral, Report } from "../../lib/types";
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
