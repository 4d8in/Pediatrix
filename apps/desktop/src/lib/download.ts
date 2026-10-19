// Export de fichiers côté poste : CSV pour Excel/LibreOffice (séparateur « ; » et BOM UTF-8,
// attendus par les tableurs en français) et JSON pour DHIS2.
function escapeCell(value: string | number): string {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(";")).join("\r\n");
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([mime.startsWith("text/csv") ? `﻿${content}` : content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
