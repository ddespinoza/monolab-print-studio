import { z } from "zod";

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
const LETTER = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
export const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} es obligatorio.` })
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar los ${max} caracteres.`);

const fileSchema = z.object({
  token: z.string().regex(TOKEN_PATTERN, "Archivo no válido. Vuelva a subirlo."),
  name: z.string().min(1).max(120),
  volumeCm3: z.number().min(0).max(1_000_000),
  /** Scale the customer applied in the viewer; volume and size already include it. */
  scalePercent: z.number().int().min(5).max(250),
  size: z.object({
    x: z.number().min(0).max(100_000),
    y: z.number().min(0).max(100_000),
    z: z.number().min(0).max(100_000),
  }),
});

/** Single source of truth for client and server validation. Messages are user-facing Spanish. */
export const orderSchema = z.object({
  nombre: text("El nombre", 2, 80),
  email: z
    .string({ error: "El correo es obligatorio." })
    .trim()
    .max(120)
    .email("Ingrese un correo válido."),
  whatsapp: z
    .string({ error: "El WhatsApp es obligatorio." })
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,18}$/, "Ingrese un número de WhatsApp válido."),
  /** Initials only: the patient's full name is never collected. */
  paciente: z
    .string({ error: "Las iniciales del paciente son obligatorias." })
    .trim()
    .regex(
      new RegExp(`^[${LETTER}][${LETTER}. ]{1,7}$`),
      "Ingrese solo las iniciales del paciente, por ejemplo A. P.",
    )
    .refine(
      (v) => v.replace(new RegExp(`[^${LETTER}]`, "g"), "").length <= 4,
      "Ingrese solo las iniciales del paciente, por ejemplo A. P.",
    ),
  resina: z.enum(RESINAS, { error: "Elija un tipo de resina." }),
  entrega: z.enum(ENTREGAS.map((e) => e.id) as [string, ...string[]], {
    error: "Elija un tiempo de entrega.",
  }),
  cantidad: z
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(100, "La cantidad máxima es 100.")
    .default(1),
  notas: z.string().trim().max(500, "Las notas no pueden superar los 500 caracteres.").default(""),
  /** Honeypot: humans never see it. A filled value is accepted silently and discarded. */
  empresa: z.string().default(""),
  files: z
    .array(fileSchema)
    .min(1, "Suba al menos un archivo 3D.")
    .max(MAX_FILES, `Puede subir hasta ${MAX_FILES} archivos por pedido.`)
    .refine(
      (files) => new Set(files.map((f) => f.token)).size === files.length,
      "Hay archivos repetidos.",
    ),
});

export type OrderInput = z.infer<typeof orderSchema>;
