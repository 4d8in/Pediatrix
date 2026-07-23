import pg from "pg";

const { Pool } = pg;

let pool: InstanceType<typeof Pool> | null = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL manquant dans l'environnement.");
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 2 });
    // Sans ce handler, une erreur sur une connexion inactive du pool (ex. coupure
    // réseau vers Supabase) fait planter tout le process Node — comportement par
    // défaut de `pg`, pas une négligence à corriger ailleurs.
    pool.on("error", (error) => {
      console.error("[reporting] erreur du pool Supabase (connexion inactive) :", error.message);
    });
  }
  return pool;
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS reporting_totaux (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nb_patients INTEGER NOT NULL,
  nb_consultations INTEGER NOT NULL,
  nb_demandes_examen INTEGER NOT NULL,
  nb_rapports INTEGER NOT NULL,
  date_calcul TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reporting_examens_par_type (
  type_examen TEXT PRIMARY KEY,
  nb INTEGER NOT NULL,
  date_calcul TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reporting_consultations_par_jour (
  jour DATE PRIMARY KEY,
  nb INTEGER NOT NULL,
  date_calcul TIMESTAMPTZ NOT NULL
);
`;

export async function migrate(): Promise<void> {
  await getPool().query(MIGRATION_SQL);
}

export interface ReportingStats {
  totaux: {
    nbPatients: number;
    nbConsultations: number;
    nbDemandesExamen: number;
    nbRapports: number;
  };
  // Libellé d'examen (texte libre saisi côté Pédiatrie) -> nombre de demandes.
  examensParType: Record<string, number>;
  // Jour ("YYYY-MM-DD") -> nombre de consultations, sur la fenêtre récente.
  consultationsParJour: Record<string, number>;
}

export async function writeStats(stats: ReportingStats): Promise<void> {
  const client = await getPool().connect();
  const dateCalcul = new Date().toISOString();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO reporting_totaux (id, nb_patients, nb_consultations, nb_demandes_examen, nb_rapports, date_calcul)
       VALUES (1, $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         nb_patients = EXCLUDED.nb_patients,
         nb_consultations = EXCLUDED.nb_consultations,
         nb_demandes_examen = EXCLUDED.nb_demandes_examen,
         nb_rapports = EXCLUDED.nb_rapports,
         date_calcul = EXCLUDED.date_calcul`,
      [
        stats.totaux.nbPatients,
        stats.totaux.nbConsultations,
        stats.totaux.nbDemandesExamen,
        stats.totaux.nbRapports,
        dateCalcul,
      ],
    );

    for (const [typeExamen, nb] of Object.entries(stats.examensParType)) {
      await client.query(
        `INSERT INTO reporting_examens_par_type (type_examen, nb, date_calcul)
         VALUES ($1, $2, $3)
         ON CONFLICT (type_examen) DO UPDATE SET nb = EXCLUDED.nb, date_calcul = EXCLUDED.date_calcul`,
        [typeExamen, nb, dateCalcul],
      );
    }

    for (const [jour, nb] of Object.entries(stats.consultationsParJour)) {
      await client.query(
        `INSERT INTO reporting_consultations_par_jour (jour, nb, date_calcul)
         VALUES ($1, $2, $3)
         ON CONFLICT (jour) DO UPDATE SET nb = EXCLUDED.nb, date_calcul = EXCLUDED.date_calcul`,
        [jour, nb, dateCalcul],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
