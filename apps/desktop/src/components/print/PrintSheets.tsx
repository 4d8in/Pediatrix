import type { ReactNode } from "react";
import type { Facility, Immunization, Invoice, Patient, Prescription, Report } from "../../lib/types";
import { formatMoney } from "../../lib/utils";

// Modèles des documents imprimés. Mise en page sobre (noir sur blanc), une page A4.

const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR") : "");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");

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
  return (
    <div style={{ marginBottom: 16, fontSize: "11pt" }}>
      <strong>
        {patient.firstName} {patient.lastName}
      </strong>
      {" — "}né(e) le {patient.birthDate} — dossier {patient.mrn}
      {patient.guardian && (
        <div>
          Tuteur : {patient.guardian.name} ({patient.guardian.relationship}), {patient.guardian.phone}
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
  return (
    <Page>
      <Letterhead facility={facility} title="Ordonnance" />
      <PatientBlock patient={patient} />
      <ol style={{ paddingLeft: 20 }}>
        {prescriptions.map((rx) => (
          <li key={rx.id} style={{ marginBottom: 12 }}>
            <strong>{rx.medication ?? "Médicament"}</strong>
            <div>{rx.dosage}</div>
            <div style={{ fontSize: "10pt", color: "#444" }}>Prescrit le {dateTime(rx.date)}</div>
          </li>
        ))}
      </ol>
      <Signature label="Le médecin" />
    </Page>
  );
}

export function LabReportSheet({ facility, patient, report }: { facility: Facility; patient: Patient; report: Report }) {
  return (
    <Page>
      <Letterhead facility={facility} title="Compte rendu d'examen" />
      <PatientBlock patient={patient} />
      <h2 style={{ fontSize: "13pt", margin: "8px 0" }}>{report.exam ?? "Examen"}</h2>
      <div style={{ fontSize: "10pt", marginBottom: 8 }}>Rendu le {dateTime(report.date)}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111", textAlign: "left" }}>
            <th>Paramètre</th>
            <th>Résultat</th>
            <th>Valeurs de référence</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((result) => (
            <tr key={result.label} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{result.label}</td>
              <td style={{ fontWeight: result.flag === "H" || result.flag === "L" ? 700 : 400 }}>
                {result.value}
                {result.flag === "H" && " ↑"}
                {result.flag === "L" && " ↓"}
              </td>
              <td>{result.reference ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.conclusion && (
        <p style={{ marginTop: 12 }}>
          <strong>Conclusion :</strong> {report.conclusion}
        </p>
      )}
      <Signature label="Le biologiste" />
    </Page>
  );
}

export function VaccinationCardSheet({ facility, patient, immunizations }: { facility: Facility; patient: Patient; immunizations: Immunization[] }) {
  return (
    <Page>
      <Letterhead facility={facility} title="Carnet de vaccination" />
      <PatientBlock patient={patient} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111", textAlign: "left" }}>
            <th>Vaccin</th>
            <th>Dose</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {immunizations.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #ccc" }}>
              <td>{item.vaccine ?? ""}</td>
              <td>{item.doseNumber ?? ""}</td>
              <td>{day(item.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Signature label="Cachet et signature" />
    </Page>
  );
}

export function InvoiceSheet({ facility, invoice }: { facility: Facility; invoice: Invoice }) {
  return (
    <Page>
      <Letterhead facility={facility} title={invoice.status === "balanced" ? "Reçu" : "Facture"} />
      <div style={{ marginBottom: 16, fontSize: "11pt" }}>
        <strong>{invoice.patientName}</strong> — facture n° {invoice.id} du {day(invoice.date)}
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
            <td style={{ fontWeight: 700 }}>Total</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(invoice.total, invoice.currency)}</td>
          </tr>
          {invoice.coveragePercent > 0 && (
            <tr>
              <td>
                Pris en charge par {invoice.insurer} ({invoice.coveragePercent} %)
              </td>
              <td style={{ textAlign: "right" }}>− {formatMoney(invoice.insurerShare, invoice.currency)}</td>
            </tr>
          )}
          <tr>
            <td>Payé</td>
            <td style={{ textAlign: "right" }}>{formatMoney(invoice.paid, invoice.currency)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>Reste à payer</td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(invoice.balance, invoice.currency)}</td>
          </tr>
        </tbody>
      </table>
      <Signature label="Le caissier" />
    </Page>
  );
}
