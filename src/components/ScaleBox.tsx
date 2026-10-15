"use client";

import type { FileEntry } from "@/lib/order-state";

interface Props {
  file: FileEntry;
  onScale: (percent: number) => void;
  onAutoFit: () => void;
}

const PRESETS = [50, 75, 100, 125, 150];

export function ScaleBox({ file, onScale, onAutoFit }: Props) {
  return (
    <div className="grid gap-2 rounded-lg border border-border-medium border-l-[3px] border-l-orange bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <strong className="min-w-0 truncate text-xs uppercase text-prussian-blue">
          Escala · {file.name}
        </strong>
        <button
          type="button"
          onClick={onAutoFit}
          className="min-h-10 rounded bg-prussian-blue px-3 text-xs font-bold text-app hover:bg-deep lg:min-h-0 lg:px-2.5 lg:py-1"
        >
          Auto-ajustar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={5}
          max={250}
          value={file.scalePercent}
          onChange={(e) => onScale(Number(e.target.value))}
          aria-label="Escala del modelo"
          className="h-8 flex-1 accent-orange"
        />
        <span className="whitespace-nowrap rounded-full border border-border-light bg-canvas px-3 py-0.5 text-[13px]">
          {file.scalePercent} %
        </span>
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onScale(p)}
            aria-pressed={file.scalePercent === p}
            className={`min-h-10 flex-1 rounded border px-1 text-xs font-semibold lg:min-h-0 lg:py-1 ${file.scalePercent === p ? "border-prussian-blue bg-prussian-blue text-app" : "border-border-light bg-app text-secondary"}`}
          >
            {p} %
          </button>
        ))}
      </div>
    </div>
  );
}
