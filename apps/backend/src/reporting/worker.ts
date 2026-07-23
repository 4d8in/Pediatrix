import "dotenv/config";
import { runAggregationCycle } from "./aggregate.js";
import { closePool } from "./db.js";

const INTERVAL_MS = Number(process.env.REPORTING_INTERVAL_MS ?? 300_000);

async function cycle(): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    await runAggregationCycle();
    console.log(`[reporting] cycle terminé avec succès (${startedAt}).`);
  } catch (error) {
    // Supabase ou HAPI injoignable : on logue et on retente au prochain
    // intervalle, sans jamais arrêter la boucle ni le backend clinique.
    console.error(`[reporting] échec du cycle (${startedAt}), nouvelle tentative au prochain intervalle :`, error);
  }
}

async function shutdown(): Promise<void> {
  await closePool();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`[reporting] démarrage du service d'agrégation, intervalle = ${INTERVAL_MS} ms.`);
await cycle();
setInterval(cycle, INTERVAL_MS);
