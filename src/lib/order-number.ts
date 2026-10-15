const ID_PATTERN = /^ML-(\d+)$/;

/** Next sequential order number from the ID column of the sheet (header and junk cells ignored). */
export function nextOrderNumber(existingIds: readonly string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = ID_PATTERN.exec(id.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ML-${String(max + 1).padStart(4, "0")}`;
}
