"use client";

import { useEffect, useRef } from "react";
import type { ViewerController, ViewerModel, ViewPreset } from "@/lib/viewer";

interface Props {
  models: ViewerModel[];
  activeId?: string;
  view: { preset: ViewPreset; nonce: number };
  wireframe: boolean;
}

/** three.js is imported dynamically so the initial bundle stays small. */
export function StlViewer({ models, activeId, view, wireframe }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ViewerController | null>(null);
  const latest = useRef({ models, activeId, view, wireframe });
  useEffect(() => {
    latest.current = { models, activeId, view, wireframe };
  });

  useEffect(() => {
    let disposed = false;
    import("@/lib/viewer").then(({ ViewerController: Viewer }) => {
      if (disposed || !host.current) return;
      const v = new Viewer(host.current);
      controller.current = v;
      const l = latest.current;
      v.setModels(l.models, l.activeId);
      v.setWireframe(l.wireframe);
      v.setView(l.view.preset);
    });
    return () => {
      disposed = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => controller.current?.setModels(models, activeId), [models, activeId]);
  useEffect(() => controller.current?.setWireframe(wireframe), [wireframe]);
  useEffect(() => controller.current?.setView(view.preset), [view.preset, view.nonce]);

  return (
    <div
      ref={host}
      className="absolute inset-0"
      role="img"
      aria-label="Vista previa 3D de tu modelo sobre la base de impresión"
    />
  );
}
