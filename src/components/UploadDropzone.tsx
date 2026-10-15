"use client";

import { useRef, useState } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  compact: boolean;
  maxMb: number;
}

export function UploadDropzone({ onFiles, compact, maxMb }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = (list: FileList | null): void => {
    if (list && list.length) onFiles(Array.from(list));
    if (input.current) input.current.value = "";
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Subir archivos 3D"
      onClick={() => input.current?.click()}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())
      }
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => (e.preventDefault(), setOver(false), pick(e.dataTransfer.files))}
      className={`cursor-pointer rounded-xl border-2 border-dashed bg-surface text-center ${over ? "border-orange" : "border-border-medium"} ${compact ? "px-4 py-4" : "px-4 py-10"}`}
    >
      <p className="m-0 font-bold text-main">
        {compact ? "Arrastre más archivos aquí" : "Arrastre sus archivos 3D aquí"}
      </p>
      <p className="m-0 text-sm text-muted">
        STL, OBJ o PLY · o haga clic para explorar · hasta 10 archivos · {maxMb} MB cada uno
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept=".stl,.obj,.ply"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}
