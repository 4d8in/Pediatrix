import "dotenv/config";
import { runAggregationCycle } from "./aggregate.js";
import { closePool } from "./db.js";

try {
  await runAggregationCycle();
  console.log("[reporting] cycle unique terminé avec succès.");
  process.exitCode = 0;
} catch (error) {
  console.error("[reporting] échec du cycle unique :", error);
  process.exitCode = 1;
} finally {
  await closePool();
}
