import { escapeSheetCell } from "@/lib/sanitize";
import { formatFileLine } from "@/lib/templates";
import { totalVolumeCm3 } from "@/lib/stl-metrics";
import type { OrderInput } from "@/lib/validation";

export const HEADERS = [
  "ID Pedido",
  "Fecha",
  "Estado",
  "Nombre",
  "Email",
  "WhatsApp",
  "Ciudad",
  "Entrega",
  "Archivos (Drive)",
  "Nº archivos",
  "Volumen total (cm³)",
  "Detalle archivos",
  "Material",
  "Color",
  "Relleno (%)",
  "Cantidad",
  "Notas",
  "Estado notificado",
  "Última notificación",
] as const;

export interface OrderRow {
  rowNumber: number;
  id: string;
  fecha: string;
  estado: string;
  nombre: string;
  email: string;
  whatsapp: string;
  ciudad: string;
  entrega: string;
  drive: string;
  nArchivos: string;
  volumen: string;
  detalle: string;
  material: string;
  color: string;
  relleno: string;
  cantidad: string;
  notas: string;
  notificado: string;
  ultima: string;
}

export interface NewOrder {
  id: string;
  fecha: string;
  order: OrderInput;
  driveLink: string;
}

/** Row for the Pedidos tab (columns A-S). Customer text is escaped against spreadsheet formulas. */
export function buildOrderRow({ id, fecha, order, driveLink }: NewOrder): string[] {
  const e = escapeSheetCell;
  return [
    id,
    fecha,
    "Nuevo",
    e(order.nombre),
    e(order.email),
    e(order.whatsapp),
    e(order.ciudad),
    "Retiro",
    driveLink,
    String(order.files.length),
    totalVolumeCm3(order.files.map((f) => f.volumeCm3)).toFixed(1),
    e(order.files.map(formatFileLine).join("\n")),
    e(order.material),
    e(order.color),
    String(order.relleno),
    String(order.cantidad),
    e(order.notas),
    "Nuevo",
    fecha,
  ];
}

export function parseOrderRow(row: readonly string[], rowNumber: number): OrderRow {
  const c = (i: number): string => row[i] ?? "";
  return {
    rowNumber,
    id: c(0),
    fecha: c(1),
    estado: c(2).trim(),
    nombre: c(3),
    email: c(4),
    whatsapp: c(5),
    ciudad: c(6),
    entrega: c(7),
    drive: c(8),
    nArchivos: c(9),
    volumen: c(10),
    detalle: c(11),
    material: c(12),
    color: c(13),
    relleno: c(14),
    cantidad: c(15),
    notas: c(16),
    notificado: c(17).trim(),
    ultima: c(18),
  };
}
