const MAX_NAME = 32;

/** Keeps the start and the extension of a long file name: "informe_largo….stl". */
function shorten(name: string): string {
  if (name.length <= MAX_NAME) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${name.slice(0, MAX_NAME - ext.length - 1)}…${ext}`;
}

/** Text for the viewer's loading screen, or undefined when no file is being read. */
export function loadingLabel(
  files: readonly { name: string; parse: string }[],
): string | undefined {
  const reading = files.filter((f) => f.parse === "reading").map((f) => shorten(f.name));
  if (reading.length === 0) return undefined;
  if (reading.length === 1) return `Leyendo ${reading[0]}…`;
  if (reading.length === 2) return `Leyendo ${reading[0]} y ${reading[1]}…`;
  return `Leyendo ${reading[0]} y ${reading.length - 1} archivos más…`;
}
