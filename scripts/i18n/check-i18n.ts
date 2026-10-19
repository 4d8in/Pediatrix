// Contrôle de couverture de l'interface anglaise. À lancer :
//   cd apps/backend && npx tsx ../../scripts/i18n/check-i18n.ts [--strict]
// - ERREUR : un t("texte français") sans entrée dans le dictionnaire anglais (apps/desktop/src/lib/i18n/en).
// - AVERTISSEMENT : texte français affiché mais non enveloppé dans t() (heuristique).
// --strict fait aussi échouer sur les avertissements.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { EN } from "../../apps/desktop/src/lib/i18n/en/index.ts";

const ROOT = new URL("../../apps/desktop/src/", import.meta.url).pathname;
const SKIP = ["lib/i18n/", "lib/types.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|ts)$/.test(name) ? [full] : [];
  });
}

const T_CALL = /\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`$]*)`)/g;
const FRENCH_HINT = /[àâçéèêëîïôûùüœÀÉÈ]|\b(le|la|les|des|du|de|un|une|pour|avec|sans|est|pas|vous|votre|aucun|aucune|nouveau|nouvelle|enregistrer|annuler|valider|patient|erreur|chargement)\b/i;

const errors: string[] = [];
const warnings: string[] = [];
const used = new Set<string>();

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (SKIP.some((s) => rel.startsWith(s) || rel === s)) continue;
  const source = readFileSync(file, "utf-8");

  for (const match of source.matchAll(T_CALL)) {
    const key = (match[1] ?? match[2] ?? match[3] ?? "").replace(/\\"/g, '"').replace(/\\'/g, "'");
    used.add(key);
    if (!(key in EN)) errors.push(`${rel}: pas de traduction pour « ${key} »`);
  }

  source.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("import ")) return;
    const candidates: string[] = [];
    for (const m of line.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ]{3,}[^<>{}]*)</g)) candidates.push(m[1].trim());
    for (const m of line.matchAll(/\b(?:placeholder|title|aria-label|alt|label)="([^"{}]*[A-Za-zÀ-ÿ]{3,}[^"{}]*)"/g)) candidates.push(m[1].trim());
    // Ligne de texte nu à l'intérieur d'un élément multi-lignes.
    if (/^[A-Za-zÀ-ÿ'’][^<>{}=;()]*$/.test(trimmed) && /\s/.test(trimmed) && !/^(return|const|let|if|else|case|import|export|type|interface)\b/.test(trimmed)) {
      candidates.push(trimmed);
    }
    for (const text of candidates) {
      if (text && FRENCH_HINT.test(text) && !(text in EN)) warnings.push(`${rel}:${index + 1}: non traduit ? « ${text} »`);
    }
  });
}

const unused = Object.keys(EN).filter((key) => !used.has(key));
console.log(`${used.size} chaînes utilisées, ${Object.keys(EN).length} traductions, ${unused.length} inutilisées.`);
for (const line of errors) console.error(`ERREUR ${line}`);
for (const line of warnings.slice(0, 200)) console.warn(`AVERT. ${line}`);
console.log(`${errors.length} erreur(s), ${warnings.length} avertissement(s).`);
if (errors.length > 0 || (process.argv.includes("--strict") && warnings.length > 0)) process.exit(1);
