"use client";

import { useState } from "react";
import { StlViewer } from "@/components/StlViewer";
import { exceedsBuild } from "@/lib/fit";
import { loadingLabel } from "@/lib/loading-label";
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
  "min-h-10 flex-1 rounded-md border border-border-light bg-app px-3 text-xs font-semibold text-secondary hover:border-prussian-blue lg:min-h-0 lg:flex-none lg:px-2.5 lg:py-1";
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
  const loading = loadingLabel(files);
  const tooBig = metrics ? exceedsBuild(metrics.size) : false;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-border-medium bg-canvas lg:sticky lg:top-20 lg:block lg:min-h-[34rem]">
      {/* Phones: toolbar, canvas and metrics stack so nothing covers the model. Desktop: overlays on the canvas. */}
      <div className="order-1 flex flex-wrap gap-1.5 p-2 lg:absolute lg:left-3 lg:right-3 lg:top-3 lg:z-10 lg:p-0">
        <div className="flex w-full gap-1 rounded-lg border border-border-medium bg-app p-1 lg:w-auto">
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
          <div className="flex w-full gap-1 rounded-lg border border-border-medium bg-app p-1 lg:w-auto">
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
        <div className="flex w-full gap-1 rounded-lg border border-border-medium bg-app p-1 lg:w-auto">
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
      <div className="relative order-2 h-72 sm:h-96 lg:absolute lg:inset-0 lg:h-auto">
        {ready.length > 0 ? (
          <StlViewer models={models} activeId={active?.id} view={view} wireframe={wireframe} />
        ) : (
          !loading && (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted">
              Aquí verás tu modelo en 3D
            </p>
          )
        )}
        {loading && (
          <div
            role="status"
            className="loading-screen absolute inset-0 z-10 grid content-center justify-items-center gap-3 bg-canvas/85 px-6 text-center"
          >
            <span className="spinner spinner-lg" aria-hidden="true" />
            <p className="m-0 font-semibold text-main">{loading}</p>
            <p className="m-0 text-sm text-muted">
              Con archivos grandes puede tardar unos segundos.
            </p>
          </div>
        )}
      </div>
      {tooBig && (
        <p
          role="alert"
          className="order-3 m-2 rounded border-l-4 border-orange bg-app px-3 py-2 text-sm text-main lg:absolute lg:bottom-20 lg:left-3 lg:right-28 lg:m-0"
        >
          Este modelo excede el volumen de impresión. Reduce la escala o gíralo.
        </p>
      )}
      <span className="order-3 mx-2 mt-2 self-end rounded-full border border-border-light bg-app px-3 py-0.5 text-xs lg:absolute lg:bottom-20 lg:right-3 lg:m-0">
        Unidades: mm
      </span>
      <dl className="order-4 m-2 grid grid-cols-2 gap-3 rounded-lg border border-border-medium bg-app px-4 py-2.5 sm:grid-cols-4 lg:absolute lg:bottom-3 lg:left-3 lg:right-3 lg:m-0">
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
