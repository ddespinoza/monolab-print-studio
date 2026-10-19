"use client";

import { useReducer, useRef, useState } from "react";
import { FileList } from "@/components/FileList";
import { emptyForm, OrderForm, type FormValues } from "@/components/OrderForm";
import { ScaleBox } from "@/components/ScaleBox";
import { SuccessPanel, type Summary } from "@/components/SuccessPanel";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ViewerPanel } from "@/components/ViewerPanel";
import { ENTREGA_LABELS, MESSAGES } from "@/lib/content";
import { parseModel } from "@/lib/model-loader";
import {
  canSubmit,
  entryMetrics,
  initialState,
  orderReducer,
  submitBlockers,
  totalVolume,
  type Mode,
} from "@/lib/order-state";
import { computeMetrics } from "@/lib/stl-metrics";
import { whatsappLink } from "@/lib/whatsapp";
import { postOrder, uploadFile } from "@/lib/upload-client";
import { MAX_FILES } from "@/lib/order-options";

interface Props {
  whatsappNumber: string;
  retiro: string;
  maxUploadMb: number;
}

const HINTS = {
  busy: "Se habilitará cuando tus archivos terminen de subir.",
  empty: "Sube al menos un archivo 3D.",
  failed: "Reintenta o quita los archivos con error.",
  exceeds: "Reduce la escala de los modelos que exceden el volumen de impresión.",
} as const;

const FIELD_ORDER = [
  "files",
  "resina",
  "cantidad",
  "nombre",
  "paciente",
  "telefono",
  "email",
  "entrega",
  "notas",
] as const;

type Errors = Partial<Record<keyof FormValues | "files", string>>;

export function OrderSection({ whatsappNumber, retiro, maxUploadMb }: Props) {
  const [state, dispatch] = useReducer(orderReducer, initialState);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [notices, setNotices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [summary, setSummary] = useState<Summary>();
  const originals = useRef(new Map<string, File>());

  const startUpload = (id: string, file: File): void => {
    dispatch({ type: "uploadStart", id });
    uploadFile(file, (progress) => dispatch({ type: "uploadProgress", id, progress }))
      .then((r) => dispatch({ type: "uploadDone", id, token: r.token }))
      .catch(() => dispatch({ type: "uploadFailed", id, error: MESSAGES.uploadError }));
  };

  const process = async (id: string, file: File): Promise<void> => {
    try {
      const positions = parseModel(file.name, await file.arrayBuffer());
      dispatch({ type: "parsed", id, positions, base: computeMetrics(positions) });
    } catch {
      dispatch({ type: "parseFailed", id, error: MESSAGES.parseError });
      return;
    }
    startUpload(id, file);
  };

  const addFiles = (list: File[]): void => {
    const problems: string[] = [];
    const accepted: File[] = [];
    let room = MAX_FILES - state.files.length;
    for (const f of list) {
      if (!/\.(stl|obj|ply)$/i.test(f.name)) problems.push(`${f.name}: ${MESSAGES.badType}`);
      else if (f.size > maxUploadMb * 1_048_576)
        problems.push(`${f.name}: ${MESSAGES.tooBig(maxUploadMb)}`);
      else if (room <= 0) problems.push(`${f.name}: ${MESSAGES.tooMany}`);
      else {
        accepted.push(f);
        room--;
      }
    }
    setNotices(problems);
    const entries = accepted.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      sizeBytes: f.size,
      file: f,
    }));
    for (const e of entries) originals.current.set(e.id, e.file);
    dispatch({
      type: "add",
      files: entries.map(({ id, name, sizeBytes }) => ({ id, name, sizeBytes })),
    });
    for (const e of entries) void process(e.id, e.file);
  };

  const submit = async (): Promise<void> => {
    setFormError(undefined);
    const files = state.files.flatMap((f) => {
      const m = entryMetrics(f);
      return f.parse === "ready" && f.upload.token && m
        ? [
            {
              token: f.upload.token,
              name: f.name,
              volumeCm3: m.volumeCm3,
              size: m.size,
              scalePercent: f.scalePercent,
            },
          ]
        : [];
    });
    // The validation library (zod) loads on demand so it is not part of the first page load.
    const { orderSchema } = await import("@/lib/validation");
    const parsed = orderSchema.safeParse({ ...form, cantidad: Number(form.cantidad), files });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof Errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      setFormError(MESSAGES.reviewFields);
      // The button sits below the fields, so errors render off screen: bring the first one into view.
      const first = FIELD_ORDER.find((k) => next[k]);
      const target =
        first === "files"
          ? document.getElementById("pedido-archivos")
          : first && document.getElementById(first);
      target?.scrollIntoView({ block: "center" });
      if (target instanceof HTMLElement && first !== "files") target.focus({ preventScroll: true });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await postOrder(parsed.data);
    setSubmitting(false);
    if (!result.ok || !result.id) {
      setFormError(MESSAGES.sendError);
      return;
    }
    setSummary({
      orderId: result.id,
      nFiles: files.length,
      volumeCm3: totalVolume(state),
      resina: form.resina,
      cantidad: Number(form.cantidad),
      entrega: ENTREGA_LABELS[form.entrega]?.title ?? form.entrega,
      paciente: form.paciente,
      retiro,
    });
    dispatch({ type: "reset" });
    setForm(emptyForm);
    originals.current.clear();
    document.getElementById("pedido")?.scrollIntoView();
  };

  if (summary) return <SuccessPanel summary={summary} whatsappNumber={whatsappNumber} />;

  const active = state.files.find((f) => f.id === state.activeId);
  const blockers = submitBlockers(state);
  const hint = blockers.length ? HINTS[blockers[0]] : undefined;
  const setMode = (mode: Mode): void => dispatch({ type: "setMode", mode });
  const total = totalVolume(state);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.85fr] lg:items-start">
      <ViewerPanel
        files={state.files}
        active={active}
        mode={state.mode}
        onRotate={(axis) => active && dispatch({ type: "rotate", id: active.id, axis })}
      />
      <div className="grid gap-3">
        <div
          role="group"
          aria-label="Modo de uso"
          className="flex gap-1 rounded-lg border border-border-medium bg-canvas p-1"
        >
          {(["simple", "advanced"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={state.mode === m}
              onClick={() => setMode(m)}
              className={`min-h-11 flex-1 rounded-md px-2 text-[13px] font-bold ${state.mode === m ? "bg-prussian-blue text-app" : "text-secondary"}`}
            >
              {m === "simple" ? "Modo simple" : "Modo avanzado"}
            </button>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">
          {state.mode === "simple"
            ? "Sube uno o más archivos STL, OBJ o PLY. Si alguno excede el volumen de impresión, lo ajustaremos automáticamente."
            : "Mira todos tus archivos juntos, oculta o muestra cada modelo, y ajusta su escala y rotación."}
        </p>
        <div id="pedido-archivos" className="scroll-mt-24" />
        <UploadDropzone onFiles={addFiles} compact={state.files.length > 0} maxMb={maxUploadMb} />
        {errors.files && (
          <p
            role="alert"
            className="m-0 border-l-[3px] border-prussian-blue pl-2 text-[13px] text-main"
          >
            {errors.files}
          </p>
        )}
        {notices.map((n) => (
          <p
            key={n}
            role="alert"
            className="m-0 rounded border-l-4 border-prussian-blue bg-canvas px-3 py-2 text-sm text-main"
          >
            {n}
          </p>
        ))}
        <FileList
          files={state.files}
          activeId={state.activeId}
          mode={state.mode}
          onSelect={(id) => dispatch({ type: "select", id })}
          onRemove={(id) => (originals.current.delete(id), dispatch({ type: "remove", id }))}
          onToggle={(id) => dispatch({ type: "toggleVisible", id })}
          onRetry={(id) => {
            const file = originals.current.get(id);
            if (file) startUpload(id, file);
          }}
        />
        {state.files.length > 0 && (
          <p className="m-0">
            <strong>Volumen total: {total.toFixed(1).replace(".", ",")} cm³</strong>
            <span className="text-sm text-muted">
              {" "}
              · Medidas en mm (suponemos que tu modelo está en milímetros)
            </span>
          </p>
        )}
        {state.mode === "advanced" && active && active.parse === "ready" && (
          <ScaleBox
            file={active}
            onScale={(percent) => dispatch({ type: "setScale", id: active.id, percent })}
            onAutoFit={() => dispatch({ type: "autoFit", id: active.id })}
          />
        )}
        <OrderForm
          values={form}
          errors={errors}
          retiro={retiro}
          submitting={submitting}
          busy={blockers.includes("busy")}
          disabled={!canSubmit(state)}
          hint={hint}
          formError={formError}
          whatsappHref={whatsappLink(whatsappNumber, "")}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={() => void submit()}
        />
      </div>
    </div>
  );
}
