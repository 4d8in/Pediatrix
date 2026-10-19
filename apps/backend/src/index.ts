import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { fhirLogRoute } from "./routes/fhir-log.route.js";
import { statsRoute } from "./routes/stats.route.js";
import { dashboardCountersRoute } from "./routes/dashboard-counters.route.js";
import { dashboardOverviewRoute } from "./routes/dashboard-overview.route.js";
import { activeQueueRoute } from "./routes/active-queue.route.js";
import { recentResultsRoute } from "./routes/recent-results.route.js";
import { markResultReadRoute } from "./routes/mark-result-read.route.js";
import { updatesRoute } from "./routes/updates.route.js";
import { auditPlugin } from "./socle/audit/audit.plugin.js";
import { listAuditRoute } from "./socle/audit/list-audit.route.js";
import { jwtPlugin } from "./socle/auth/jwt.plugin.js";
import { loginRoute } from "./socle/auth/login.route.js";
import { changePasswordRoute } from "./socle/auth/change-password.route.js";
import { meRoute } from "./socle/auth/me.route.js";
import { listUsersRoute } from "./socle/auth/list-users.route.js";
import { getProfileRoute } from "./socle/auth/get-profile.route.js";
import { updateProfileRoute } from "./socle/auth/update-profile.route.js";
import { createUserRoute } from "./socle/auth/create-user.route.js";
import { resetUserPasswordRoute } from "./socle/auth/reset-user-password.route.js";
import { setUserActiveRoute } from "./socle/auth/set-user-active.route.js";
import { createPatientRoute } from "./socle/patients/create-patient.route.js";
import { listPatientsRoute } from "./socle/patients/list-patients.route.js";
import { getPatientRoute } from "./socle/patients/get-patient.route.js";
import { getPatientReportsRoute } from "./socle/patients/get-patient-reports.route.js";
import { createEncounterRoute } from "./modules/pediatrie/create-encounter.route.js";
import { createServiceRequestRoute } from "./modules/pediatrie/create-service-request.route.js";
import { listLabRequestsRoute } from "./modules/laboratoire/list-lab-requests.route.js";
import { createReportRoute } from "./modules/laboratoire/create-report.route.js";
import { listBedsRoute } from "./modules/hospitalisation/list-beds.route.js";
import { createStayRoute } from "./modules/hospitalisation/create-stay.route.js";
import { transferStayRoute } from "./modules/hospitalisation/transfer-stay.route.js";
import { dischargeStayRoute } from "./modules/hospitalisation/discharge-stay.route.js";
import { updateBedStatusRoute } from "./modules/hospitalisation/update-bed-status.route.js";
import { listPatientStaysRoute } from "./modules/hospitalisation/list-patient-stays.route.js";
import { labSummaryRoute } from "./modules/laboratoire/lab-summary.route.js";
import { labCatalogRoute } from "./modules/laboratoire/lab-catalog.route.js";
import { listFormularyRoute } from "./modules/pharmacie/list-formulary.route.js";
import { stockLevelsRoute } from "./modules/pharmacie/stock-levels.route.js";
import { receiveStockRoute } from "./modules/pharmacie/receive-stock.route.js";
import { listPendingPrescriptionsRoute } from "./modules/pharmacie/list-pending-prescriptions.route.js";
import { dispensePrescriptionRoute } from "./modules/pharmacie/dispense-prescription.route.js";
import { getTariffsRoute } from "./modules/facturation/get-tariffs.route.js";
import { putTariffsRoute } from "./modules/facturation/put-tariffs.route.js";
import { listPendingEncountersRoute } from "./modules/facturation/list-pending-encounters.route.js";
import { createInvoiceRoute } from "./modules/facturation/create-invoice.route.js";
import { listInvoicesRoute } from "./modules/facturation/list-invoices.route.js";
import { addPaymentRoute } from "./modules/facturation/add-payment.route.js";
import { billingSummaryRoute } from "./modules/facturation/billing-summary.route.js";
import { listDoctorsRoute } from "./modules/rendez-vous/list-doctors.route.js";
import { listSlotsRoute } from "./modules/rendez-vous/list-slots.route.js";
import { listAppointmentsRoute } from "./modules/rendez-vous/list-appointments.route.js";
import { createAppointmentRoute } from "./modules/rendez-vous/create-appointment.route.js";
import { updateAppointmentStatusRoute } from "./modules/rendez-vous/update-appointment-status.route.js";
import { imagingSummaryRoute } from "./modules/radiologie/imaging-summary.route.js";
import { createImagingRequestRoute } from "./modules/radiologie/create-imaging-request.route.js";
import { listImagingRequestsRoute } from "./modules/radiologie/list-imaging-requests.route.js";
import { createImagingReportRoute } from "./modules/radiologie/create-imaging-report.route.js";
import { getPatientImagingReportsRoute } from "./modules/radiologie/get-patient-imaging-reports.route.js";
import { createImmunizationRoute } from "./modules/vaccination/create-immunization.route.js";
import { listImmunizationsRoute } from "./modules/vaccination/list-immunizations.route.js";
import { createGrowthRoute } from "./modules/croissance/create-growth.route.js";
import { listGrowthRoute } from "./modules/croissance/list-growth.route.js";
import { createAllergyRoute } from "./modules/prescription/create-allergy.route.js";
import { listAllergiesRoute } from "./modules/prescription/list-allergies.route.js";
import { createPrescriptionRoute } from "./modules/prescription/create-prescription.route.js";
import { listPrescriptionsRoute } from "./modules/prescription/list-prescriptions.route.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

// Le frontend (serveur de dev Vite, ou fenêtre Electron en production via le
// protocole app://pediatrix, voir apps/desktop/electron/main.ts) est la
// seule origine autorisée : le frontend passe toujours par ce backend,
// jamais directement par HAPI.
await app.register(cors, {
  origin: ["http://localhost:1420", "app://pediatrix"],
});

// En-têtes de sécurité sur toutes les réponses ; les réponses de l'API (données de
// santé) ne doivent jamais être mises en cache par un navigateur ou un proxy.
app.addHook("onSend", async (request, reply) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  if (request.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
});

await app.register(healthRoute);

// Mises à jour des postes desktop (electron-updater) servies sur le LAN.
await app.register(updatesRoute);

// Socle : authentification JWT.
await app.register(jwtPlugin);
await app.register(auditPlugin);
await app.register(listAuditRoute);
await app.register(loginRoute);
await app.register(meRoute);
await app.register(changePasswordRoute);
await app.register(listUsersRoute);
await app.register(getProfileRoute);
await app.register(updateProfileRoute);
await app.register(createUserRoute);
await app.register(resetUserPasswordRoute);
await app.register(setUserActiveRoute);

// Socle : identité patient.
await app.register(createPatientRoute);
await app.register(listPatientsRoute);
await app.register(getPatientRoute);
await app.register(getPatientReportsRoute);

// Module Pédiatrie : consultation (Encounter + Observations) et demande d'examen.
await app.register(createEncounterRoute);
await app.register(createServiceRequestRoute);

// Module Laboratoire : file d'attente et rapport (DiagnosticReport + Observations).
await app.register(listLabRequestsRoute);
await app.register(createReportRoute);

// Module Radiologie (module-souche) : même contrat FHIR que le Laboratoire,
// juste branché au socle — preuve de modularité.
await app.register(createImagingRequestRoute);
await app.register(listImagingRequestsRoute);
await app.register(createImagingReportRoute);
await app.register(getPatientImagingReportsRoute);

// Module Vaccination : carnet vaccinal (Immunization), intégré au dossier patient.
await app.register(createImmunizationRoute);
await app.register(listImmunizationsRoute);

// Module Croissance : mesures (Observation poids/taille/périmètre crânien),
// intégré au dossier patient.
await app.register(createGrowthRoute);
await app.register(listGrowthRoute);

// Module Prescription : allergies connues (AllergyIntolerance) et prescriptions
// (MedicationRequest), avec contrôle d'allergie avant enregistrement.
await app.register(createAllergyRoute);
await app.register(listAllergiesRoute);
await app.register(createPrescriptionRoute);
await app.register(listPrescriptionsRoute);

// Vitrine d'interopérabilité : dernières ressources FHIR émises.
await app.register(fhirLogRoute);

// Statistiques du service, calculées à la volée depuis HAPI (Directeur +
// Administrateur technique) — indépendant du service d'agrégation reporting/Supabase.
await app.register(statsRoute);

// Compteurs du tableau de bord (infirmière/médecin/directeur), calculés à la
// volée depuis HAPI — distinct de /api/stats, dont l'accès est restreint.
await app.register(dashboardCountersRoute);
await app.register(dashboardOverviewRoute);
await app.register(activeQueueRoute);
await app.register(recentResultsRoute);
await app.register(labSummaryRoute);
await app.register(labCatalogRoute);
await app.register(listFormularyRoute);
await app.register(stockLevelsRoute);
await app.register(receiveStockRoute);
await app.register(listPendingPrescriptionsRoute);
await app.register(dispensePrescriptionRoute);
await app.register(getTariffsRoute);
await app.register(putTariffsRoute);
await app.register(listPendingEncountersRoute);
await app.register(createInvoiceRoute);
await app.register(listInvoicesRoute);
await app.register(addPaymentRoute);
await app.register(billingSummaryRoute);
await app.register(listDoctorsRoute);
await app.register(listSlotsRoute);
await app.register(listAppointmentsRoute);
await app.register(createAppointmentRoute);
await app.register(updateAppointmentStatusRoute);
await app.register(imagingSummaryRoute);
await app.register(markResultReadRoute);

// Module Hospitalisation (gestion des lits) : services et lits = Location,
// séjours = Encounter de classe IMP, distincts des consultations (AMB).
await app.register(listBedsRoute);
await app.register(createStayRoute);
await app.register(transferStayRoute);
await app.register(dischargeStayRoute);
await app.register(updateBedStatusRoute);
await app.register(listPatientStaysRoute);

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
