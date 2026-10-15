const MAX_FILENAME = 80;

/** Safe filename: `[^A-Za-z0-9._-]` becomes `_`, repeats collapse, <= 80 chars, keeps the .stl extension. */
export function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/\.stl$/i, "");
  const stem = base
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, MAX_FILENAME - ".stl".length);
  return stem === "" ? "archivo.stl" : `${stem}.stl`;
}

/** Neutralise spreadsheet formulas: a leading = + - @ tab or CR gets a literal apostrophe prefix. */
export function escapeSheetCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** For values that end up in mail headers or single-line cells. */
export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}
