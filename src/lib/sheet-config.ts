import { logger } from "@/lib/logger";

/** Where customers pay (Config keys BANCO_*). `correo` is optional; every other field is required. */
export interface BankData {
  titular: string;
  rut: string;
  banco: string;
  tipo: string;
  cuenta: string;
  correo: string;
}

/** Config keys for the bank data, seeded blank by setup so the operator sees what to fill in. */
export const BANK_KEYS = {
  BANCO_TITULAR: "titular",
  BANCO_RUT: "rut",
  BANCO_BANCO: "banco",
  BANCO_TIPO_CUENTA: "tipo",
  BANCO_CUENTA: "cuenta",
  BANCO_CORREO: "correo",
} as const satisfies Record<string, keyof BankData>;

export interface SheetConfig {
  RETIRO_DIRECCION: string;
  RETIRO_HORARIO: string;
  /** "SI": the 5-minute job sends status emails by itself. "NO" (default): only the sheet buttons send. */
  ENVIO_AUTOMATICO: "SI" | "NO";
  /** Days after the Entregado/Cancelado email before the order's Drive files are deleted. 0 = never. */
  ELIMINAR_ARCHIVOS_DIAS: number;
  /** Complete bank data, or null when any required BANCO_* value is missing (nothing half-filled is ever mailed). */
  BANCO: BankData | null;
}

export const CONFIG_DEFAULTS: Omit<SheetConfig, "BANCO"> = {
  RETIRO_DIRECCION: "Dirección por confirmar. Escríbenos por WhatsApp.",
  RETIRO_HORARIO: "Solo previa coordinación: escríbenos o llámanos al +56 9 4862 3705.",
  ENVIO_AUTOMATICO: "NO",
  ELIMINAR_ARCHIVOS_DIAS: 30,
};

export function isAutomatic(config: Pick<SheetConfig, "ENVIO_AUTOMATICO">): boolean {
  return config.ENVIO_AUTOMATICO === "SI";
}

const oneLine = (text: string): string => text.replace(/\s*[\r\n]+\s*/g, " ").trim();

/** Whole days; blank keeps the default, "0" or "NO" turns deletion off, anything unreadable also turns it off (deleting is irreversible). */
function parseRetentionDays(value: string): number {
  if (value === "") return CONFIG_DEFAULTS.ELIMINAR_ARCHIVOS_DIAS;
  if (/^no$/i.test(value)) return 0;
  return /^\d+$/.test(value) ? Number(value) : 0;
}

/** Rows of the Config tab (key | value). Blank or missing values fall back to defaults. */
export function parseConfig(rows: readonly (readonly string[])[]): SheetConfig {
  const config: SheetConfig = { ...CONFIG_DEFAULTS, BANCO: null };
  const bank: Partial<Record<keyof BankData, string>> = {};
  for (const [key, value] of rows) {
    const v = (value ?? "").trim();
    if ((key === "RETIRO_DIRECCION" || key === "RETIRO_HORARIO") && v) config[key] = v;
    if (key in BANK_KEYS) bank[BANK_KEYS[key as keyof typeof BANK_KEYS]] = oneLine(v);
    if (key === "ELIMINAR_ARCHIVOS_DIAS") config.ELIMINAR_ARCHIVOS_DIAS = parseRetentionDays(v);
    if (key === "ENVIO_AUTOMATICO") {
      const plain = v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      config.ENVIO_AUTOMATICO = plain === "SI" ? "SI" : "NO";
    }
  }
  const { titular, rut, banco, tipo, cuenta, correo = "" } = bank;
  if (titular && rut && banco && tipo && cuenta)
    config.BANCO = { titular, rut, banco, tipo, cuenta, correo };
  return config;
}

/** TTL cache that keeps serving stale data if a reload fails. */
export function cachedLoader<T>(
  load: () => Promise<T>,
  ttlMs = 300_000,
  now: () => number = Date.now,
): () => Promise<T> {
  let value: T | undefined;
  let loadedAt = 0;
  return async () => {
    if (value !== undefined && now() - loadedAt < ttlMs) return value;
    try {
      value = await load();
      loadedAt = now();
    } catch (error) {
      if (value === undefined) throw error;
      logger.warn("config reload failed; serving stale value", { error: String(error) });
    }
    return value as T;
  };
}
