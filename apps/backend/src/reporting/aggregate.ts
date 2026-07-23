import { migrate, writeStats, type ReportingStats } from "./db.js";
import { countConsultationsParJour, countExamensParType, countTotaux } from "./hapi-stats.js";

const WINDOW_DAYS = Number(process.env.REPORTING_WINDOW_DAYS ?? 14);

export async function runAggregationCycle(): Promise<void> {
  const [totaux, examensParType, consultationsParJour] = await Promise.all([
    countTotaux(),
    countExamensParType(),
    countConsultationsParJour(WINDOW_DAYS),
  ]);

  const stats: ReportingStats = { totaux, examensParType, consultationsParJour };

  await migrate();
  await writeStats(stats);
}
