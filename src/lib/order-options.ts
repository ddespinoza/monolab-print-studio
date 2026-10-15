/** Order constants without any dependency, so the browser can use them without downloading the validation library. */
export const ESTADOS = [
  "Nuevo",
  "Cotizado",
  "Confirmado",
  "En cola",
  "Imprimiendo",
  "Listo",
  "Entregado",
  "Cancelado",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const MAX_FILES = 10;
export const RESINAS = ["Estándar", "Resina Tough"] as const;
/** Flat delivery fee per order, in CLP. Informational: the quote itself is typed in the sheet. */
export const ENTREGAS = [
  { id: "Flash", dias: 2, tarifa: 10000 },
  { id: "Normal", dias: 7, tarifa: 7500 },
] as const;
export const TOKEN_PATTERN = /^[a-f0-9]{32}$/;
