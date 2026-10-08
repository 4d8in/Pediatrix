import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";

// Dossier où l'administrateur dépose le contenu de apps/desktop/release/
// (latest.yml, latest-linux.yml, installeurs, .blockmap) après un `npm run dist`.
const UPDATES_DIR = path.resolve(process.env.UPDATES_DIR ?? "updates");

const CONTENT_TYPES: Record<string, string> = {
  ".yml": "text/yaml; charset=utf-8",
  ".exe": "application/octet-stream",
  ".appimage": "application/octet-stream",
  ".deb": "application/octet-stream",
  ".blockmap": "application/octet-stream",
};

// Mises à jour des postes Electron (electron-updater, source "generic") via le LAN.
// Route volontairement sans JWT : electron-updater vérifie les mises à jour
// avant toute connexion utilisateur. Elle ne sert que des fichiers
// d'installation, aucune donnée patient.
export async function updatesRoute(app: FastifyInstance) {
  app.get<{ Params: { file: string } }>("/updates/:file", async (request, reply) => {
    const { file } = request.params;
    const extension = path.extname(file).toLowerCase();

    // Nom de fichier simple uniquement (pas de "../", pas de sous-dossier)
    // et uniquement les types produits par electron-builder.
    if (file !== path.basename(file) || file.startsWith(".") || !(extension in CONTENT_TYPES)) {
      return reply.code(404).send({ error: "Fichier introuvable." });
    }

    const filePath = path.join(UPDATES_DIR, file);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) {
      return reply.code(404).send({ error: "Fichier introuvable." });
    }

    return reply
      .header("Content-Type", CONTENT_TYPES[extension])
      .header("Content-Length", info.size)
      .header("Cache-Control", "no-cache")
      .send(createReadStream(filePath));
  });
}
