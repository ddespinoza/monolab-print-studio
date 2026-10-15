import { logger } from "@/lib/logger";

export interface SheetConfig {
  RETIRO_DIRECCION: string;
  RETIRO_HORARIO: string;
}

export const CONFIG_DEFAULTS: SheetConfig = {
  RETIRO_DIRECCION: "Dirección por confirmar. Escríbanos por WhatsApp.",
  RETIRO_HORARIO: "Horario por confirmar. Escríbanos por WhatsApp.",
};

/** Rows of the Config tab (key | value). Blank or missing values fall back to defaults. */
export function parseConfig(rows: readonly (readonly string[])[]): SheetConfig {
  const config = { ...CONFIG_DEFAULTS };
  for (const [key, value] of rows) {
    const v = (value ?? "").trim();
    if ((key === "RETIRO_DIRECCION" || key === "RETIRO_HORARIO") && v) config[key] = v;
  }
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
