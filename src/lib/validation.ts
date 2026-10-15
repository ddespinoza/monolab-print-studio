import { z } from "zod";

export const ESTADOS = [
  "Nuevo",
  "En cola",
  "Imprimiendo",
  "Listo",
  "Entregado",
  "Cancelado",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const MAX_FILES = 10;
export const RELLENOS = [10, 20, 50, 100] as const;
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
  ciudad: text("La ciudad", 2, 60),
  material: text("El material", 1, 40),
  color: z.string().trim().max(40, "El color no puede superar los 40 caracteres.").default(""),
  relleno: z
    .number()
    .refine(
      (n): n is (typeof RELLENOS)[number] => (RELLENOS as readonly number[]).includes(n),
      "Elija un relleno válido.",
    )
    .default(20),
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
    .min(1, "Suba al menos un archivo STL.")
    .max(MAX_FILES, `Puede subir hasta ${MAX_FILES} archivos por pedido.`)
    .refine(
      (files) => new Set(files.map((f) => f.token)).size === files.length,
      "Hay archivos repetidos.",
    ),
});

export type OrderInput = z.infer<typeof orderSchema>;
