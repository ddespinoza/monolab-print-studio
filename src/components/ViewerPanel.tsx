"use client";

import { useState } from "react";
import { StlViewer } from "@/components/StlViewer";
import { exceedsBuild } from "@/lib/fit";
import { entryMetrics, type FileEntry, type Mode } from "@/lib/order-state";
import type { Axis } from "@/lib/orient";
import type { ViewPreset } from "@/lib/viewer";

interface Props {
  files: FileEntry[];
  active?: FileEntry;
  mode: Mode;
  onRotate: (axis: Axis) => void;
}

const VIEWS: { preset: ViewPreset; label: string }[] = [
  { preset: "iso", label: "Iso" },
  { preset: "top", label: "Superior" },
  { preset: "front", label: "Frontal" },
  { preset: "side", label: "Lateral" },
];

const toolBtn =
  "rounded-md border border-border-light bg-app px-2.5 py-1 text-xs font-semibold text-secondary hover:border-prussian-blue";
const fmt = (n: number): string => n.toFixed(1).replace(".", ",");

export function ViewerPanel({ files, active, mode, onRotate }: Props) {
  const [view, setView] = useState<{ preset: ViewPreset; nonce: number }>({
    preset: "iso",
    nonce: 0,
  });
  const [wireframe, setWireframe] = useState(false);
  const ready = files.filter((f) => f.parse === "ready" && f.positions);
  const models = ready
    .filter((f) => mode === "advanced" || f.id === active?.id)
    .map((f) => ({
      id: f.id,
      positions: f.positions as Float32Array,
      scalePercent: f.scalePercent,
      visible: f.visible,
    }));
  const metrics = active ? entryMetrics(active) : undefined;
  const tooBig = metrics ? exceedsBuild(metrics.size) : false;

  return (
    <div className="relative min-h-[28rem] overflow-hidden rounded-xl border border-border-medium bg-canvas lg:sticky lg:top-20 lg:min-h-[34rem]">
      {ready.length > 0 ? (
        <StlViewer models={models} activeId={active?.id} view={view} wireframe={wireframe} />
      ) : (
        <p className="absolute inset-0 grid place-items-center text-sm text-muted">
          Aquí verá su modelo en 3D
        </p>
      )}
      <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
        <div className="flex gap-1 rounded-lg border border-border-medium bg-app p-1">
          {VIEWS.map((v) => (
            <button
              key={v.preset}
              type="button"
              aria-pressed={view.preset === v.preset}
              onClick={() => setView({ preset: v.preset, nonce: view.nonce + 1 })}
              className={`${toolBtn} ${view.preset === v.preset ? "!border-prussian-blue !bg-prussian-blue !text-app" : ""}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {mode === "advanced" && (
          <div className="flex gap-1 rounded-lg border border-border-medium bg-app p-1">
            {(["x", "y", "z"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={!active}
                onClick={() => onRotate(a)}
                className={toolBtn}
              >
                Girar {a.toUpperCase()} 90°
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 rounded-lg border border-border-medium bg-app p-1">
          <button
            type="button"
            aria-pressed={wireframe}
            onClick={() => setWireframe(!wireframe)}
            className={toolBtn}
          >
            Malla
          </button>
          <button
            type="button"
            onClick={() => setView({ ...view, nonce: view.nonce + 1 })}
            className={toolBtn}
          >
            Centrar
          </button>
        </div>
      </div>
      {tooBig && (
        <p
          role="alert"
          className="absolute bottom-20 left-3 right-28 m-0 rounded border-l-4 border-orange bg-app px-3 py-2 text-sm text-main"
        >
          Este modelo excede el volumen de impresión. Reduzca la escala o gírelo.
        </p>
      )}
      <span className="absolute bottom-20 right-3 rounded-full border border-border-light bg-app px-3 py-0.5 text-xs">
        Unidades: mm
      </span>
      <dl className="absolute bottom-3 left-3 right-3 m-0 grid grid-cols-2 gap-3 rounded-lg border border-border-medium bg-app px-4 py-2.5 sm:grid-cols-4">
        {[
          ["X", metrics ? `${fmt(metrics.size.x)} mm` : "—"],
          ["Y", metrics ? `${fmt(metrics.size.y)} mm` : "—"],
          ["Z", metrics ? `${fmt(metrics.size.z)} mm` : "—"],
          ["Volumen", metrics ? `${fmt(metrics.volumeCm3)} cm³` : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">{k}</dt>
            <dd className="m-0 font-extrabold text-prussian-blue">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
