"use client";

import { MESSAGES } from "@/lib/content";
import { entryMetrics, type FileEntry, type Mode } from "@/lib/order-state";

interface Props {
  files: FileEntry[];
  activeId?: string;
  mode: Mode;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onRetry: (id: string) => void;
}

const size = (bytes: number): string =>
  bytes < 1_048_576
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1_048_576).toFixed(1).replace(".", ",")} MB`;
const fmt = (n: number): string => n.toFixed(1).replace(".", ",");

export function FileList({ files, activeId, mode, onSelect, onRemove, onToggle, onRetry }: Props) {
  if (files.length === 0) return null;
  return (
    <ul aria-label="Archivos de la solicitud" className="m-0 grid list-none gap-2 p-0">
      {files.map((f) => {
        const m = entryMetrics(f);
        const selected = f.id === activeId;
        return (
          <li
            key={f.id}
            className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg border bg-surface px-4 py-3 ${selected ? "border-prussian-blue ring-2 ring-prussian-blue" : "border-border-light"}`}
          >
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              disabled={f.parse !== "ready"}
              className="min-h-10 min-w-0 truncate text-left font-semibold text-main"
            >
              {f.name}
              {f.scalePercent !== 100 && (
                <span className="ml-2 rounded border border-border-medium bg-canvas px-1.5 text-[10px] font-extrabold text-prussian-blue">
                  {f.scalePercent} %
                </span>
              )}
              {f.autoAdjusted && (
                <span className="ml-1 rounded border border-border-medium bg-canvas px-1.5 text-[10px] font-extrabold text-prussian-blue">
                  AUTO
                </span>
              )}
            </button>
            <span className="flex items-center gap-1">
              {mode === "advanced" && f.parse === "ready" && (
                <button
                  type="button"
                  onClick={() => onToggle(f.id)}
                  aria-pressed={f.visible}
                  aria-label={`${f.visible ? "Ocultar" : "Mostrar"} ${f.name}`}
                  className="min-h-10 rounded border border-border-medium px-3 text-xs text-secondary"
                >
                  {f.visible ? "Ocultar" : "Mostrar"}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Quitar ${f.name}`}
                className="min-h-10 min-w-10 text-2xl leading-none text-muted"
              >
                ×
              </button>
            </span>
            {f.parse === "error" ? (
              <p
                role="alert"
                className="col-span-2 m-0 rounded border-l-4 border-prussian-blue bg-canvas px-3 py-2 text-sm text-main"
              >
                {f.parseError ?? MESSAGES.parseError}
              </p>
            ) : (
              <>
                <span className="col-span-2 text-[13px] text-muted">
                  {size(f.sizeBytes)}
                  {m &&
                    ` · ${fmt(m.volumeCm3)} cm³ · ${fmt(m.size.x)}×${fmt(m.size.y)}×${fmt(m.size.z)} mm`}
                </span>
                <div
                  role="progressbar"
                  aria-label={`Subida de ${f.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={f.upload.progress}
                  className="col-span-2 h-2 overflow-hidden rounded-full bg-border-light"
                >
                  <span
                    className="block h-full bg-orange transition-[width]"
                    style={{ width: `${f.upload.status === "done" ? 100 : f.upload.progress}%` }}
                  />
                </div>
                {f.upload.status === "failed" && (
                  <p
                    role="alert"
                    className="col-span-2 m-0 flex items-center justify-between gap-2 rounded border-l-4 border-prussian-blue bg-canvas px-3 py-2 text-sm text-main"
                  >
                    {MESSAGES.uploadError}
                    <button
                      type="button"
                      onClick={() => onRetry(f.id)}
                      className="min-h-10 rounded bg-prussian-blue px-3 text-xs font-bold text-app"
                    >
                      Reintentar
                    </button>
                  </p>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
