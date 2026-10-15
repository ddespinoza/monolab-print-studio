import { escapeSheetCell } from "@/lib/sanitize";
import { formatFileLine } from "@/lib/templates";
import { totalVolumeCm3 } from "@/lib/stl-metrics";
import { ENTREGAS, type OrderInput } from "@/lib/validation";

export const HEADERS = [
  "ID Pedido",
  "Fecha",
  "Estado",
  "Odontólogo",
  "Email",
  "WhatsApp",
  "Iniciales paciente",
  "Entrega",
  "Tarifa entrega (CLP)",
  "Archivos (Drive)",
  "Nº archivos",
  "Volumen total (cm³)",
  "Detalle archivos",
  "Resina",
  "Copias",
  "Notas",
  "Cotización",
  "Confirmado",
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
  paciente: string;
  entrega: string;
  tarifa: string;
  drive: string;
  nArchivos: string;
  volumen: string;
  detalle: string;
  resina: string;
  cantidad: string;
  notas: string;
  cotizacion: string;
  confirmado: string;
  notificado: string;
  ultima: string;
}

export interface NewOrder {
  id: string;
  fecha: string;
  order: OrderInput;
  driveLink: string;
}

/** Row for the Pedidos tab (columns A-T). Customer text is escaped against spreadsheet formulas. */
export function buildOrderRow({ id, fecha, order, driveLink }: NewOrder): string[] {
  const e = escapeSheetCell;
  const tarifa = ENTREGAS.find((o) => o.id === order.entrega)?.tarifa ?? 0;
  return [
    id,
    fecha,
    "Nuevo",
    e(order.nombre),
    e(order.email),
    e(order.whatsapp),
    e(order.paciente),
    order.entrega,
    String(tarifa),
    driveLink,
    String(order.files.length),
    totalVolumeCm3(order.files.map((f) => f.volumeCm3)).toFixed(1),
    e(order.files.map(formatFileLine).join("\n")),
    e(order.resina),
    String(order.cantidad),
    e(order.notas),
    "",
    "",
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
    paciente: c(6),
    entrega: c(7),
    tarifa: c(8),
    drive: c(9),
    nArchivos: c(10),
    volumen: c(11),
    detalle: c(12),
    resina: c(13),
    cantidad: c(14),
    notas: c(15),
    cotizacion: c(16),
    confirmado: c(17),
    notificado: c(18).trim(),
    ultima: c(19),
  };
}
