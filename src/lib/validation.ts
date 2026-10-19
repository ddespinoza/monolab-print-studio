import { z } from "zod";

export {
  ENTREGAS,
  ESTADOS,
  MAX_FILES,
  RESINAS,
  TOKEN_PATTERN,
  type Estado,
} from "@/lib/order-options";
import { ENTREGAS, MAX_FILES, RESINAS, TOKEN_PATTERN } from "@/lib/order-options";
const LETTER = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

const INITIALS_MSG = "Escribe solo las iniciales (1 a 4 letras), por ejemplo A. P., AP o A.P.M.";

const text = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} es obligatorio.` })
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar los ${max} caracteres.`);

const fileSchema = z.object({
  token: z.string().regex(TOKEN_PATTERN, "Archivo no válido. Vuelve a subirlo."),
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

/** Chilean numbers: optional +56 / 56, then 9 digits starting 2-9 (mobile 9…, landline 2… or regional). */
function isChileanPhone(value: string): boolean {
  if (!/^\+?[0-9(][0-9 ()-]{6,18}$/.test(value)) return false;
  return /^(56)?[2-9][0-9]{8}$/.test(value.replace(/\D/g, ""));
}

/** Single source of truth for client and server validation. Messages are user-facing Spanish. */
export const orderSchema = z.object({
  nombre: text("El nombre", 2, 80),
  email: z
    .string({ error: "El correo es obligatorio." })
    .trim()
    .max(120)
    .email("Ingresa un correo válido."),
  telefono: z
    .string({ error: "El teléfono es obligatorio." })
    .trim()
    .refine(isChileanPhone, "Ingresa un teléfono chileno válido, por ejemplo +56 9 1234 5678."),
  /** Initials only: the patient's full name is never collected. */
  paciente: z
    .string({ error: "Las iniciales del paciente son obligatorias." })
    .trim()
    .max(12, INITIALS_MSG)
    .regex(new RegExp(`^[${LETTER}][${LETTER}.\\- ]*$`), INITIALS_MSG)
    .refine((v) => {
      const letters = v.replace(new RegExp(`[^${LETTER}]`, "g"), "").length;
      return letters >= 1 && letters <= 4;
    }, INITIALS_MSG),
  resina: z.enum(RESINAS, { error: "Elige un tipo de resina." }),
  entrega: z.enum(ENTREGAS.map((e) => e.id) as [string, ...string[]], {
    error: "Elige un tiempo de entrega.",
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
    .min(1, "Sube al menos un archivo 3D.")
    .max(MAX_FILES, `Puedes subir hasta ${MAX_FILES} archivos por pedido.`)
    .refine(
      (files) => new Set(files.map((f) => f.token)).size === files.length,
      "Hay archivos repetidos.",
    ),
});

export type OrderInput = z.infer<typeof orderSchema>;
