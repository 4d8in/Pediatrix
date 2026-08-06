import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { fhirLogRoute } from "./routes/fhir-log.route.js";
import { statsRoute } from "./routes/stats.route.js";
import { dashboardCountersRoute } from "./routes/dashboard-counters.route.js";
import { jwtPlugin } from "./socle/auth/jwt.plugin.js";
import { loginRoute } from "./socle/auth/login.route.js";
import { meRoute } from "./socle/auth/me.route.js";
import { createPatientRoute } from "./socle/patients/create-patient.route.js";
import { listPatientsRoute } from "./socle/patients/list-patients.route.js";
import { getPatientRoute } from "./socle/patients/get-patient.route.js";
import { getPatientReportsRoute } from "./socle/patients/get-patient-reports.route.js";
import { createEncounterRoute } from "./modules/pediatrie/create-encounter.route.js";
import { createServiceRequestRoute } from "./modules/pediatrie/create-service-request.route.js";
import { listLabRequestsRoute } from "./modules/laboratoire/list-lab-requests.route.js";
import { createReportRoute } from "./modules/laboratoire/create-report.route.js";
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

// Le frontend (serveur de dev Vite, ou webview Tauri en production) est la
// seule origine autorisée : le frontend passe toujours par ce backend,
// jamais directement par HAPI.
await app.register(cors, {
  origin: ["http://localhost:1420", "tauri://localhost"],
});

await app.register(healthRoute);

// Socle : authentification JWT.
await app.register(jwtPlugin);
await app.register(loginRoute);
await app.register(meRoute);

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

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
