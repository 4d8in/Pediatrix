import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { fhirLogRoute } from "./routes/fhir-log.route.js";
import { createPatientRoute } from "./socle/patients/create-patient.route.js";
import { listPatientsRoute } from "./socle/patients/list-patients.route.js";
import { getPatientRoute } from "./socle/patients/get-patient.route.js";
import { getPatientReportsRoute } from "./socle/patients/get-patient-reports.route.js";
import { createEncounterRoute } from "./modules/pediatrie/create-encounter.route.js";
import { createServiceRequestRoute } from "./modules/pediatrie/create-service-request.route.js";
import { listLabRequestsRoute } from "./modules/laboratoire/list-lab-requests.route.js";
import { createReportRoute } from "./modules/laboratoire/create-report.route.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });

// Le frontend (serveur de dev Vite, ou webview Tauri en production) est la
// seule origine autorisée : le frontend passe toujours par ce backend,
// jamais directement par HAPI.
await app.register(cors, {
  origin: ["http://localhost:1420", "tauri://localhost"],
});

await app.register(healthRoute);

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

// Vitrine d'interopérabilité : dernières ressources FHIR émises.
await app.register(fhirLogRoute);

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
