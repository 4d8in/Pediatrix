// Génère docs/ROLES-ET-ROUTES.md : qui peut appeler quoi, lu directement dans le code
// des routes (authenticate / authorize). À relancer après toute modification de route :
//   cd apps/backend && npx tsx ../../scripts/docs/access-matrix.ts
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");
const OUT = join(process.cwd(), "..", "..", "docs", "ROLES-ET-ROUTES.md");

const ROLE_LABELS: Record<string, string> = {
  nurse: "Infirmière",
  doctor: "Médecin",
  lab_tech: "Technicien labo",
  radiologist: "Radiologue",
  pharmacist: "Pharmacien",
  cashier: "Caissier",
  receptionist: "Réceptionniste",
  director: "Directeur",
  tech_admin: "Admin technique",
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function constants(source: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]\s*as const/g)) {
    result[match[1]] = [...match[2].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  }
  return result;
}

interface Row {
  method: string;
  path: string;
  access: string;
  module: string;
}

const rows: Row[] = [];
for (const file of walk(SRC)) {
  const source = readFileSync(file, "utf-8");
  const consts = constants(source);
  const calls = [...source.matchAll(/app\.(get|post|put|delete|patch)(?:<[^>]*>)?\(\s*"([^"]+)"/g)];
  calls.forEach((call, index) => {
    const end = calls[index + 1]?.index ?? source.length;
    const block = source.slice(call.index, end);
    const authorize = /authorize\(([^)]*)\)/.exec(block);
    let access: string;
    if (authorize) {
      const roles = new Set<string>();
      for (const part of authorize[1].split(",").map((p) => p.trim()).filter(Boolean)) {
        if (part.startsWith("...")) (consts[part.slice(3)] ?? []).forEach((r) => roles.add(r));
        else roles.add(part.replace(/"/g, ""));
      }
      access = [...roles].map((r) => ROLE_LABELS[r] ?? r).join(", ");
    } else if (/authenticate/.test(block)) {
      access = "Tout utilisateur connecté";
    } else {
      access = "Public (sans connexion)";
    }
    const rel = relative(SRC, file).split("/");
    rows.push({ method: call[1].toUpperCase(), path: call[2], access, module: rel[0] === "modules" ? rel[1] : rel[0] === "socle" ? `socle/${rel[1]}` : rel[0] });
  });
}

rows.sort((a, b) => a.module.localeCompare(b.module) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
const modules = [...new Set(rows.map((r) => r.module))];

let md = "# Rôles et routes\n\n";
md += "Tableau généré automatiquement depuis le code (`scripts/docs/access-matrix.ts`) : il ne peut pas diverger des contrôles réellement appliqués.\n";
md += "Chaque route de l'API vérifie le jeton (`authenticate`) puis le rôle (`authorize`) ; le masquage des écrans côté interface n'est qu'un confort.\n\n";
md += `${rows.length} routes.\n`;
for (const module of modules) {
  md += `\n## ${module}\n\n| Méthode | Route | Rôles autorisés |\n| --- | --- | --- |\n`;
  for (const row of rows.filter((r) => r.module === module)) md += `| ${row.method} | \`${row.path}\` | ${row.access} |\n`;
}
writeFileSync(OUT, md);
console.log(`${rows.length} routes écrites dans ${OUT}`);
