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
          className="rounded bg-prussian-blue px-2.5 py-1 text-xs font-bold text-app hover:bg-deep"
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
          className="flex-1 accent-orange"
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
            className={`flex-1 rounded border px-1 py-1 text-xs font-semibold ${file.scalePercent === p ? "border-prussian-blue bg-prussian-blue text-app" : "border-border-light bg-app text-secondary"}`}
          >
            {p} %
          </button>
        ))}
      </div>
    </div>
  );
}
