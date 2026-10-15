const MAX_FILENAME = 80;
const MODEL_EXT = /\.(stl|obj|ply)$/i;

/** Safe filename: `[^A-Za-z0-9._-]` becomes `_`, repeats collapse, <= 80 chars, keeps a .stl/.obj/.ply extension. */
export function sanitizeFilename(name: string, fallbackExt = ".stl"): string {
  const trimmed = name.trim();
  const ext = (MODEL_EXT.exec(trimmed)?.[0] ?? fallbackExt).toLowerCase();
  const stem = trimmed
    .replace(MODEL_EXT, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "")
    .slice(0, MAX_FILENAME - ext.length);
  return stem === "" ? `archivo${ext}` : `${stem}${ext}`;
}

/** Drive folder for an order: id plus the patient's initials (letters and dots only). */
export function folderName(orderId: string, initials: string): string {
  return `${orderId} - ${initials.replace(/[^\p{L}.]/gu, "")}`;
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
